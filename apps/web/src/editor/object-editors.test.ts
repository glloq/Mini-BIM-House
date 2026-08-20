import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import { loadDemoProject } from '../demo-project.js';
import { ProjectCommandDispatcher } from '@house-technical-designer/editor-core';
import {
  OBJECT_EDITORS,
  editsFor,
  gripsFor,
  inspectObject,
  sharedEditsFor,
} from './object-editors.js';

function demo(): Project {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file.project;
}

/** One object of each family the reference house holds. */
const SUBJECTS = [
  ['wall-south', 'WALL'],
  ['opening-entry', 'OPENING'],
  ['space-living', 'SPACE'],
  ['slab-ground', 'SLAB'],
  ['roof-south', 'ROOF'],
  ['water:sink', 'NETWORK_NODE'],
  ['water:branch-sink', 'NETWORK_EDGE'],
] as const;

describe('the object families the editor knows', () => {
  it('describes every family the reference house holds', () => {
    const project = demo();
    for (const [objectId, kind] of SUBJECTS)
      expect(inspectObject(project, objectId).kind, objectId).toBe(kind);
  });

  it('offers editable properties for the families that have them', () => {
    const project = demo();
    for (const [objectId, kind] of SUBJECTS) {
      // A segment is described but not edited from the inspector: its physical
      // properties are those of the network, and the networks workspace holds
      // them.
      if (kind === 'NETWORK_EDGE') continue;
      expect(editsFor(project, objectId).length, objectId).toBeGreaterThan(0);
    }
  });

  it('routes each family to its own properties', () => {
    const project = demo();
    expect(editsFor(project, 'roof-south').map(({ id }) => id)).toContain(
      'slopeDeg',
    );
    expect(editsFor(project, 'slab-ground').map(({ id }) => id)).toContain(
      'elevationOffsetMm',
    );
    // A family that declines an identifier lets the next one answer: slabs and
    // roofs share a description and not their properties.
    expect(editsFor(project, 'slab-ground').map(({ id }) => id)).not.toContain(
      'slopeDeg',
    );
  });

  it('draws handles for the families that can be dragged', () => {
    const project = demo();
    expect(gripsFor(project, 'ground', ['wall-south']).length).toBeGreaterThan(
      0,
    );
    expect(gripsFor(project, 'ground', ['slab-ground']).length).toBeGreaterThan(
      0,
    );
    // A family with no handles is not an error: a room is edited, not dragged.
    expect(gripsFor(project, 'ground', ['space-living'])).toEqual([]);
  });

  it('draws no handles for a selection of several objects', () => {
    // A handle stands for one precise point of one precise object; several
    // would have to guess which.
    expect(gripsFor(demo(), 'ground', ['wall-south', 'wall-north'])).toEqual(
      [],
    );
  });

  it('says an unknown identifier was not found rather than failing', () => {
    const subject = inspectObject(demo(), 'nowhere');
    expect(subject.kind).toBe('UNKNOWN');
    expect(editsFor(demo(), 'nowhere')).toEqual([]);
    expect(gripsFor(demo(), 'ground', ['nowhere'])).toEqual([]);
  });

  it('names every family it registers', () => {
    for (const editor of OBJECT_EDITORS) expect(editor.label).not.toBe('');
  });
});

describe('editing several objects at once', () => {
  it('offers the properties they all have', () => {
    const shared = sharedEditsFor(demo(), ['wall-south', 'wall-north']);
    expect(shared.map(({ id }) => id)).toContain('assemblyId');
    expect(shared.map(({ id }) => id)).toContain('role');
  });

  it('says when they already agree and when they do not', () => {
    const project = demo();
    const shared = sharedEditsFor(project, ['wall-south', 'wall-west']);
    const assembly = shared.find(({ id }) => id === 'assemblyId');
    // Both are exterior walls of the same assembly.
    expect(assembly?.uniform).toBe(true);
    const length = shared.find(({ id }) => id === 'lengthMm');
    // Their lengths differ, and the panel must not present one as both.
    expect(length?.uniform).toBe(false);
  });

  it('applies one value to all of them as a single history entry', () => {
    const project = demo();
    const shared = sharedEditsFor(project, ['wall-south', 'wall-north']);
    const role = shared.find(({ id }) => id === 'role');
    const command = role?.apply('INTERIOR');
    expect(command).toBeDefined();
    if (command === undefined) return;
    const dispatcher = new ProjectCommandDispatcher(project);
    expect(dispatcher.dispatch(command).status).toBe('APPLIED');
    const walls = dispatcher.project.building.levels[0]!.walls;
    expect(
      walls
        .filter(({ id }) => id === 'wall-south' || id === 'wall-north')
        .map(({ role: value }) => value),
    ).toEqual(['INTERIOR', 'INTERIOR']);

    // One decision, one undo: both walls go back together.
    expect(dispatcher.undo().status).toBe('APPLIED');
    expect(
      dispatcher.project.building.levels[0]!.walls.filter(
        ({ id }) => id === 'wall-south' || id === 'wall-north',
      ).map(({ role: value }) => value),
    ).toEqual(['EXTERIOR', 'EXTERIOR']);
  });

  it('offers nothing when the selection has no property in common', () => {
    expect(sharedEditsFor(demo(), ['wall-south', 'space-living'])).toEqual([]);
  });

  it('offers nothing for a selection of one', () => {
    expect(sharedEditsFor(demo(), ['wall-south'])).toEqual([]);
  });
});
