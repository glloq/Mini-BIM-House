import { describe, expect, it } from 'vitest';
import {
  ProjectCommandDispatcher,
  RemoveSiteObstacleCommand,
  SetParcelBoundaryCommand,
  UpdateStructuralMemberCommand,
} from '@house-technical-designer/editor-core';
import { structuralFootprint } from '@house-technical-designer/core-domain';
import { loadDemoProject } from '../demo-project.js';
import {
  addSiteOutlineCommand,
  addStructuralMemberCommand,
} from './editing-commands.js';
import {
  boundsOf,
  editsFor,
  familyOf,
  inspectObject,
  removalCommandFor,
  similarTo,
} from './object-editors.js';

function file() {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file;
}

const PARCEL = [
  { x: -5000, y: -5000 },
  { x: 20_000, y: -5000 },
  { x: 20_000, y: 18_000 },
  { x: -5000, y: 18_000 },
];

function applied(result: ReturnType<typeof addSiteOutlineCommand>) {
  if (result.status !== 'OK') throw new Error(result.message);
  const dispatcher = new ProjectCommandDispatcher(file().project);
  const outcome = dispatcher.dispatch(result.command);
  if (outcome.status !== 'APPLIED')
    throw new Error(
      outcome.status === 'REJECTED' ? outcome.errors.join(' ') : outcome.status,
    );
  return dispatcher;
}

describe('the ground the house sits on', () => {
  it('draws the parcel the site already had room for', () => {
    // The site has held a boundary since the beginning and no screen could
    // produce one.
    const dispatcher = applied(
      addSiteOutlineCommand(
        PARCEL,
        { target: 'PARCEL', kind: 'BUILDING' },
        'obstacle-1',
      ),
    );
    expect(dispatcher.project.site.parcelBoundary?.outer).toHaveLength(4);
  });

  it('places what stands around the house, with what it is', () => {
    const dispatcher = applied(
      addSiteOutlineCommand(
        PARCEL,
        { target: 'OBSTACLE', kind: 'TREE', heightMm: 8000, name: 'Tilleul' },
        'obstacle-tree',
      ),
    );
    // The one this test planted, among the ones already on the plot.
    const obstacle = (dispatcher.project.site.obstacles ?? []).find(
      ({ id }) => id === 'obstacle-tree',
    )!;
    expect(obstacle.kind).toBe('TREE');
    expect(obstacle.heightMm).toBe(8000);
    expect(obstacle.name).toBe('Tilleul');
  });

  it('leaves the height unknown when none was given', () => {
    // Without a height, no shade can be computed, and the inspector says so
    // rather than the model claiming a number.
    const dispatcher = applied(
      addSiteOutlineCommand(
        PARCEL,
        { target: 'OBSTACLE', kind: 'BUILDING' },
        'obstacle-neighbour-two',
      ),
    );
    const obstacle = (dispatcher.project.site.obstacles ?? []).find(
      ({ id }) => id === 'obstacle-neighbour-two',
    )!;
    expect(obstacle.heightMm).toBeUndefined();
    const subject = inspectObject(dispatcher.project, 'obstacle-neighbour-two');
    const height = subject.sections
      .flatMap(({ fields }) => fields)
      .find(({ label }) => label === 'Hauteur')!;
    expect(height.value).toBeUndefined();
    expect(height.hint).toContain('ombre');
  });

  it('refuses a contour of fewer than three points', () => {
    expect(
      addSiteOutlineCommand(
        PARCEL.slice(0, 2),
        { target: 'PARCEL', kind: 'BUILDING' },
        'obstacle-1',
      ).status,
    ).toBe('ERROR');
    const dispatcher = new ProjectCommandDispatcher(file().project);
    expect(
      dispatcher.dispatch(new SetParcelBoundaryCommand(PARCEL.slice(0, 2)))
        .status,
    ).toBe('REJECTED');
  });

  it('makes the parcel and its obstacles objects of the plan', () => {
    const dispatcher = applied(
      addSiteOutlineCommand(
        PARCEL,
        { target: 'OBSTACLE', kind: 'TREE', heightMm: 8000 },
        'obstacle-tree',
      ),
    );
    expect(familyOf(dispatcher.project, 'obstacle-tree')?.label).toBe(
      'Terrain',
    );
    expect(boundsOf(dispatcher.project, 'ground', 'obstacle-tree')).toEqual({
      min: { x: -5000, y: -5000 },
      max: { x: 20_000, y: 18_000 },
    });
    expect(
      removalCommandFor(dispatcher.project, 'ground', 'obstacle-tree'),
    ).toBeDefined();
    expect(
      dispatcher.dispatch(new RemoveSiteObstacleCommand('obstacle-tree'))
        .status,
    ).toBe('APPLIED');
  });
});

describe('the structure of a storey', () => {
  function withColumn(kind: 'COLUMN' | 'BEAM' = 'COLUMN') {
    const result = addStructuralMemberCommand(
      file(),
      'ground',
      [
        { x: 5000, y: 4000 },
        { x: 9000, y: 4000 },
      ],
      { kind, widthMm: 200, depthMm: 200, heightMm: 2500 },
      'member-1',
    );
    if (result.status !== 'OK') throw new Error(result.message);
    const dispatcher = new ProjectCommandDispatcher(file().project);
    const outcome = dispatcher.dispatch(result.command);
    if (outcome.status !== 'APPLIED')
      throw new Error(
        outcome.status === 'REJECTED'
          ? outcome.errors.join(' ')
          : outcome.status,
      );
    return dispatcher;
  }

  it('stands a column at one point and runs a beam between two', () => {
    // The difference is what the member is, not how many points describe it.
    expect(
      (withColumn().project.building.levels[0]!.structure ?? [])[0]!.path,
    ).toHaveLength(1);
    expect(
      (withColumn('BEAM').project.building.levels[0]!.structure ?? [])[0]!.path,
    ).toHaveLength(2);
  });

  it('covers a footprint derived from its section', () => {
    const member = (withColumn().project.building.levels[0]!.structure ??
      [])[0]!;
    const outline = structuralFootprint(member);
    expect(outline).toHaveLength(4);
    expect(boundsOf(withColumn().project, 'ground', 'member-1')).toEqual({
      min: { x: 4900, y: 3900 },
      max: { x: 5100, y: 4100 },
    });
  });

  it('refuses a beam of no length', () => {
    const result = addStructuralMemberCommand(
      file(),
      'ground',
      [
        { x: 5000, y: 4000 },
        { x: 5000, y: 4000 },
      ],
      { kind: 'BEAM', widthMm: 200, depthMm: 400 },
      'member-flat',
    );
    if (result.status !== 'OK') throw new Error(result.message);
    expect(
      new ProjectCommandDispatcher(file().project).dispatch(result.command)
        .status,
    ).toBe('REJECTED');
  });

  it('refuses a material the project does not hold', () => {
    const dispatcher = withColumn();
    expect(
      dispatcher.dispatch(
        new UpdateStructuralMemberCommand('ground', 'member-1', {
          materialId: 'nowhere',
        }),
      ).status,
    ).toBe('REJECTED');
  });

  it('says no material is named rather than choosing one', () => {
    // Nothing can be checked without one, and the inspector says which.
    const fields = inspectObject(
      withColumn().project,
      'member-1',
    ).sections.flatMap(({ fields: rows }) => rows);
    const material = fields.find(({ label }) => label === 'Matériau')!;
    expect(material.value).toBeUndefined();
    expect(material.hint).toContain('vérifié');
  });

  it('is an object of the editor like any other', () => {
    const project = withColumn().project;
    expect(familyOf(project, 'member-1')?.label).toBe('Structure');
    expect(editsFor(project, 'member-1').map(({ id }) => id)).toContain(
      'widthMm',
    );
    expect(similarTo(project, 'ground', 'member-1')).toEqual(['member-1']);
    expect(removalCommandFor(project, 'ground', 'member-1')).toBeDefined();
  });
});
