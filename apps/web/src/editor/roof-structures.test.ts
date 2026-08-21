import { describe, expect, it } from 'vitest';
import {
  ProjectCommandDispatcher,
  UpdateRoofStructureCommand,
} from '@house-technical-designer/editor-core';
import { allRoofPlanes } from '@house-technical-designer/core-domain';
import { loadDemoProject } from '../demo-project.js';
import { addRoofStructureCommand } from './editing-commands.js';
import {
  boundsOf,
  editsFor,
  familyOf,
  inspectObject,
  removalCommandFor,
} from './object-editors.js';

function file() {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file;
}

function roofAssemblyId(): string {
  return (file().project.assemblies ?? []).find(
    ({ category }) => category === 'ROOF' || category === 'FLOOR',
  )!.id;
}

const SQUARE = [
  { x: 0, y: 0 },
  { x: 10_000, y: 0 },
  { x: 10_000, y: 8000 },
  { x: 0, y: 8000 },
];

function built(points = SQUARE, fromWalls = false) {
  const result = addRoofStructureCommand(
    file(),
    'ground',
    points,
    {
      assemblyId: roofAssemblyId(),
      slopeDeg: 35,
      overhangMm: 400,
      fromWalls,
    },
    'roof-main',
  );
  if (result.status !== 'OK') throw new Error(result.message);
  const dispatcher = new ProjectCommandDispatcher(file().project);
  const applied = dispatcher.dispatch(result.command);
  if (applied.status !== 'APPLIED')
    throw new Error(
      applied.status === 'REJECTED' ? applied.errors.join(' ') : applied.status,
    );
  return dispatcher;
}

describe('describing a roof by its outline', () => {
  it('starts every side as a slope, which is a hipped roof', () => {
    // The two-sided roof and the hipped roof share an outline; only the user
    // knows which was meant, so nothing is guessed at creation.
    const roof = (built().project.building.levels[0]!.roofStructures ?? [])[0]!;
    expect(roof.edges).toHaveLength(4);
    expect(roof.edges.every(({ kind }) => kind === 'SLOPED')).toBe(true);
  });

  it('stands at the top of the storey it is drawn on', () => {
    const level = built().project.building.levels[0]!;
    const roof = (level.roofStructures ?? [])[0]!;
    expect(roof.baseElevationMm).toBe(
      level.elevationMm + level.defaultStoreyHeightMm,
    );
  });

  it('takes the contour the walls already enclose when asked', () => {
    const roof = (built([{ x: 2500, y: 2000 }], true).project.building
      .levels[0]!.roofStructures ?? [])[0]!;
    expect(roof.footprint.outer.length).toBeGreaterThan(3);
  });

  it('refuses an assembly that cannot carry a roof', () => {
    const result = addRoofStructureCommand(
      file(),
      'ground',
      SQUARE,
      {
        assemblyId: 'assembly-exterior',
        slopeDeg: 35,
        overhangMm: 0,
        fromWalls: false,
      },
      'roof-wrong',
    );
    if (result.status !== 'OK') throw new Error(result.message);
    expect(
      new ProjectCommandDispatcher(file().project).dispatch(result.command)
        .status,
    ).toBe('REJECTED');
  });

  it('refuses to leave a roof with no slope at all', () => {
    const dispatcher = built();
    const roof = (dispatcher.project.building.levels[0]!.roofStructures ??
      [])[0]!;
    expect(
      dispatcher.dispatch(
        new UpdateRoofStructureCommand('ground', 'roof-main', {
          edges: roof.edges.map(() => ({
            kind: 'GABLE' as const,
            slopeDeg: 0,
            overhangMm: 0,
          })),
        }),
      ).status,
    ).toBe('REJECTED');
  });
});

describe('the planes a described roof yields', () => {
  it('gives the storey four planes without storing any of them', () => {
    const level = built().project.building.levels[0]!;
    // The reference house already carries planes drawn one at a time.
    const drawn = level.roofs.length;
    expect(allRoofPlanes(level)).toHaveLength(drawn + 4);
    expect(level.roofs).toHaveLength(drawn);
  });

  it('drops a plane when a side becomes a gable', () => {
    const dispatcher = built();
    const roof = (dispatcher.project.building.levels[0]!.roofStructures ??
      [])[0]!;
    dispatcher.dispatch(
      new UpdateRoofStructureCommand('ground', 'roof-main', {
        edges: roof.edges.map((edge, index) =>
          index % 2 === 1 ? { ...edge, kind: 'GABLE' as const } : edge,
        ),
      }),
    );
    const level = dispatcher.project.building.levels[0]!;
    expect(allRoofPlanes(level)).toHaveLength(level.roofs.length + 2);
  });
});

describe('a described roof as an object of the editor', () => {
  it('belongs to a family of its own', () => {
    const project = built().project;
    expect(familyOf(project, 'roof-main')?.label).toBe('Toiture complète');
    expect(inspectObject(project, 'roof-main').kind).toBe('ROOF_STRUCTURE');
  });

  it('measures what it covers, eaves included', () => {
    // A four hundred millimetre overhang on every side.
    expect(boundsOf(built().project, 'ground', 'roof-main')).toEqual({
      min: { x: -400, y: -400 },
      max: { x: 10_400, y: 8400 },
    });
  });

  it('says where its ridge stands, and that it derives it', () => {
    const fields = inspectObject(built().project, 'roof-main').sections.flatMap(
      ({ fields: rows }) => rows,
    );
    const ridge = fields.find(({ label }) => label === 'Faîtage')!;
    expect(ridge.value).toBeDefined();
    expect(ridge.hint).toContain('Déduit');
  });

  it('offers each side on its own, and can be taken back off the plan', () => {
    const ids = editsFor(built().project, 'roof-main').map(({ id }) => id);
    expect(ids).toContain('edge0Kind');
    expect(ids).toContain('edge3Overhang');
    expect(
      removalCommandFor(built().project, 'ground', 'roof-main'),
    ).toBeDefined();
  });
});
