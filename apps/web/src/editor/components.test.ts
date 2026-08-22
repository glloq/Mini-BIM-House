import { describe, expect, it } from 'vitest';
import {
  ProjectCommandDispatcher,
  RemoveComponentCommand,
  UpdateComponentCommand,
} from '@house-technical-designer/editor-core';
import { loadDemoProject } from '../demo-project.js';
import { placeComponentCommand } from './editing-commands.js';
import {
  boundsOf,
  contextActionsFor,
  editsFor,
  familyOf,
  inspectObject,
  relationshipsOf,
  removalCommandFor,
  similarTo,
} from './object-editors.js';

function file() {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file;
}

/** The reference house with one radiator standing in the living room. */
function withRadiator(point = { x: 2500, y: 2000 }, id = 'component-radiator') {
  const source = file();
  const result = placeComponentCommand(
    source,
    'ground',
    point,
    { category: 'HEATING', name: 'Radiateur séjour', elevationMm: 150 },
    id,
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

/** The one this suite just placed, among the ones the house already holds. */
function placed(
  dispatcher: ProjectCommandDispatcher,
  id = 'component-radiator',
) {
  const found = dispatcher.project.building.levels
    .flatMap((level) => level.components ?? [])
    .find((component) => component.id === id);
  if (found === undefined) throw new Error(`no ${id}`);
  return found;
}

describe('placing a thing in the building', () => {
  it('stands where it was put, on the storey being drawn', () => {
    const component = placed(withRadiator());
    expect(component.position).toEqual({ x: 2500, y: 2000 });
    expect(component.levelId).toBe('ground');
    expect(component.elevationMm).toBe(150);
  });

  it('reads the room from the plan instead of asking for it', () => {
    expect(placed(withRadiator()).spaceId).toBeDefined();
  });

  it('leaves the room unsaid when the point is in none', () => {
    // A component outside every room has no room; it is not in the first one.
    expect(
      placed(withRadiator({ x: 80_000, y: 80_000 })).spaceId,
    ).toBeUndefined();
  });

  it('refuses a catalogue model the project does not hold', () => {
    const result = placeComponentCommand(
      file(),
      'ground',
      { x: 2500, y: 2000 },
      { category: 'HEATING', definitionId: 'nowhere', elevationMm: 0 },
      'component-broken',
    );
    if (result.status !== 'OK') throw new Error(result.message);
    const dispatcher = new ProjectCommandDispatcher(file().project);
    expect(dispatcher.dispatch(result.command).status).toBe('REJECTED');
  });

  it('undoes the placement', () => {
    const dispatcher = withRadiator();
    expect(dispatcher.undo().status).toBe('APPLIED');
    expect(
      (dispatcher.project.building.levels[0]!.components ?? []).some(
        ({ id }) => id === 'component-radiator',
      ),
    ).toBe(false);
  });
});

describe('a component as an object of the editor', () => {
  it('belongs to a family of its own', () => {
    const project = withRadiator().project;
    expect(familyOf(project, 'component-radiator')?.label).toBe('Composant');
    expect(inspectObject(project, 'component-radiator').kind).toBe('COMPONENT');
  });

  it('shows what it stands for and says what it does not', () => {
    const subject = inspectObject(withRadiator().project, 'component-radiator');
    const fields = subject.sections.flatMap(({ fields: rows }) => rows);
    const model = fields.find(({ label }) => label === 'Modèle catalogue')!;
    // The properties of the model belong to the model; this one names none.
    expect(model.value).toBeUndefined();
    expect(model.hint).toContain('catalogue');
  });

  it('offers the properties of the placed object and not of its model', () => {
    const ids = editsFor(withRadiator().project, 'component-radiator').map(
      ({ id }) => id,
    );
    expect(ids).toContain('elevationMm');
    expect(ids).toContain('rotationDeg');
    expect(ids).toContain('definitionId');
    // Nothing of the model itself: a power written here would be a second
    // answer to a question the catalogue already answers.
    expect(ids).not.toContain('powerW');
  });

  it('can be measured, gathered with its like, and taken back off the plan', () => {
    const project = withRadiator().project;
    expect(boundsOf(project, 'ground', 'component-radiator')).toBeDefined();
    expect(similarTo(project, 'ground', 'component-radiator')).toEqual([
      'component-radiator',
    ]);
    expect(
      removalCommandFor(project, 'ground', 'component-radiator'),
    ).toBeDefined();
    expect(contextActionsFor(project, 'ground', 'component-radiator')).toEqual(
      [],
    );
  });

  it('names the room it stands in', () => {
    const ties = relationshipsOf(
      withRadiator().project,
      'ground',
      'component-radiator',
    );
    expect(ties.map(({ role }) => role)).toContain('Pièce');
  });

  it('changes what it stands for and drops it again', () => {
    const dispatcher = withRadiator();
    expect(
      dispatcher.dispatch(
        new UpdateComponentCommand('ground', 'component-radiator', {
          name: null,
          rotationDeg: 90,
        }),
      ).status,
    ).toBe('APPLIED');
    const component = placed(dispatcher);
    expect(component.name).toBeUndefined();
    expect(component.rotationDeg).toBe(90);
  });

  it('refuses to be moved to a room the level does not hold', () => {
    const dispatcher = withRadiator();
    expect(
      dispatcher.dispatch(
        new UpdateComponentCommand('ground', 'component-radiator', {
          spaceId: 'nowhere',
        }),
      ).status,
    ).toBe('REJECTED');
  });

  it('says the component is gone rather than removing nothing', () => {
    const dispatcher = withRadiator();
    expect(
      dispatcher.dispatch(new RemoveComponentCommand('ground', 'nowhere'))
        .status,
    ).toBe('REJECTED');
  });
});
