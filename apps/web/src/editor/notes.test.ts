import { describe, expect, it } from 'vitest';
import {
  ProjectCommandDispatcher,
  UpdateTextNoteCommand,
} from '@house-technical-designer/editor-core';
import { isTextNote } from '@house-technical-designer/core-domain';
import type { ProjectFile } from '@house-technical-designer/core-domain';
import {
  buildPlanView,
  defaultVisibility,
} from '@house-technical-designer/view-query';
import {
  loadProjectJson,
  serializeProjectFile,
} from '@house-technical-designer/project-io/files';
import { loadDemoProject } from '../demo-project.js';
import { addTextNoteCommand } from './editing-commands.js';
import {
  boundsOf,
  capabilitiesOf,
  editsFor,
  familyOf,
  inspectObject,
  listedFamilies,
  removalCommandFor,
} from './object-editors.js';

function file(): ProjectFile {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file;
}

function placed(text = 'Reprise en sous-œuvre') {
  const source = file();
  const result = addTextNoteCommand(
    source,
    'ground',
    [{ x: 2000, y: 1500 }],
    { text, heightMm: 2.5 },
    'note-1',
  );
  if (result.status !== 'OK') throw new Error(result.message);
  const dispatcher = new ProjectCommandDispatcher(source.project);
  const applied = dispatcher.dispatch(result.command);
  if (applied.status !== 'APPLIED')
    throw new Error(
      applied.status === 'REJECTED' ? applied.errors.join(' ') : applied.status,
    );
  return dispatcher;
}

describe('writing on the drawing what the model does not say', () => {
  it('puts the note where it was placed, with what was written', () => {
    const note = placed().project.building.levels[0]!.annotations.find(
      (annotation) => isTextNote(annotation),
    )!;
    expect(note.text).toBe('Reprise en sous-œuvre');
    expect(note.at).toEqual({ x: 2000, y: 1500 });
  });

  it('refuses an annotation with nothing written on it', () => {
    // An annotation with no text is an invisible object nobody can find again.
    const result = addTextNoteCommand(
      file(),
      'ground',
      [{ x: 0, y: 0 }],
      { text: '   ', heightMm: 2.5 },
      'note-empty',
    );
    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') return;
    expect(result.message).toContain('texte');
  });

  it('refuses to empty one that already says something', () => {
    const dispatcher = placed();
    expect(
      dispatcher.dispatch(
        new UpdateTextNoteCommand('ground', 'note-1', { text: '  ' }),
      ).status,
    ).toBe('REJECTED');
  });

  it('is drawn as text, on its own layer', () => {
    const view = buildPlanView(placed().project, {
      levelId: 'ground',
      layers: defaultVisibility(),
    });
    const drawn = view.primitives.find(({ id }) => id === 'note:note-1')!;
    expect(drawn.geometry.kind).toBe('TEXT');
    expect(drawn.layer).toBe('annotation.notes');
    if (drawn.geometry.kind !== 'TEXT') return;
    expect(drawn.geometry.text).toBe('Reprise en sous-œuvre');
  });

  it('disappears with its layer and comes back with it', () => {
    const project = placed().project;
    const hidden = buildPlanView(project, {
      levelId: 'ground',
      layers: { ...defaultVisibility(), 'annotation.notes': false },
    });
    expect(hidden.primitives.some(({ id }) => id === 'note:note-1')).toBe(
      false,
    );
  });

  it('is an object of the editor like any other', () => {
    const project = placed().project;
    expect(familyOf(project, 'note-1')?.label).toBe('Annotation');
    expect(inspectObject(project, 'note-1').kind).toBe('NOTE');
    expect(editsFor(project, 'note-1').map(({ id }) => id)).toContain('text');
    expect(boundsOf(project, 'ground', 'note-1')).toEqual({
      min: { x: 2000, y: 1500 },
      max: { x: 2000, y: 1500 },
    });
    expect(removalCommandFor(project, 'ground', 'note-1')).toBeDefined();
    expect(capabilitiesOf(project, 'note-1').movable).toBe(true);
  });

  it('is found by name, under a family of its own', () => {
    const families = listedFamilies(placed().project, 'ground');
    const notes = families.find(({ label }) => label === 'Annotations')!;
    expect(notes.objects).toEqual([
      { objectId: 'note-1', label: 'Reprise en sous-œuvre' },
    ]);
  });

  it('says plainly that no calculation reads it', () => {
    const fields = inspectObject(placed().project, 'note-1').sections.flatMap(
      ({ fields: rows }) => rows,
    );
    expect(fields.find(({ label }) => label === 'Lue par')?.value).toBe(
      'personne',
    );
  });

  it('survives being written to a file and read back', () => {
    const source = file();
    const project = placed().project;
    const written = serializeProjectFile({ ...source, project });
    const read = loadProjectJson(written);
    expect(read.status).toBe('OK');
    if (read.status !== 'OK') return;
    const note = read.file.project.building.levels[0]!.annotations.find(
      (annotation) => isTextNote(annotation),
    );
    expect(note?.text).toBe('Reprise en sous-œuvre');
  });

  it('is refused by the reader when it says nothing', () => {
    const source = file();
    const project = placed().project;
    const ground = project.building.levels[0]!;
    const emptied = {
      ...source,
      project: {
        ...project,
        building: {
          ...project.building,
          levels: [
            {
              ...ground,
              annotations: ground.annotations.map((annotation) =>
                isTextNote(annotation)
                  ? { ...annotation, text: ' ' }
                  : annotation,
              ),
            },
          ],
        },
      },
    };
    const read = loadProjectJson(JSON.stringify(emptied));
    expect(read.status).not.toBe('OK');
  });
});
