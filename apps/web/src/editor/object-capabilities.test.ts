import { describe, expect, it } from 'vitest';
import {
  ProjectCommandDispatcher,
  SetParcelBoundaryCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import { entityId } from '@house-technical-designer/core-domain';
import type {
  Project,
  ProjectFile,
} from '@house-technical-designer/core-domain';
import { assemblyId } from '@house-technical-designer/assemblies';
import { loadDemoProject } from '../demo-project.js';
import {
  clipboardCount,
  copyObjects,
  duplicateObjectsCommand,
  moveObjectsCommand,
  pasteClipboardCommand,
  transformObjectsCommand,
} from './editing-commands.js';
import {
  boundsOf,
  capabilitiesOf,
  selectionCapabilities,
} from './object-editors.js';

function file(): ProjectFile {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file;
}

/**
 * The reference house with one object of every family added by lots C to H.
 *
 * The demonstration project holds walls, openings, rooms, slabs, roof planes
 * and a water network; the families added since are the ones that fell through
 * the chains of `if` this replaces, so they have to be here to be tested.
 */
function populated(): ProjectFile {
  const source = file();
  const ground = source.project.building.levels[0]!;
  const project: Project = {
    ...source.project,
    site: {
      ...source.project.site,
      obstacles: [
        {
          id: entityId('obstacle-tree'),
          boundary: {
            outer: [
              { x: 0, y: 0 },
              { x: 1000, y: 0 },
              { x: 1000, y: 1000 },
            ],
          },
          kind: 'TREE',
          heightMm: 8000,
        },
      ],
    },
    building: {
      ...source.project.building,
      levels: [
        {
          ...ground,
          stairs: [
            {
              id: entityId('stair-main'),
              type: 'STAIR',
              levelId: ground.id,
              topLevelId: entityId('upper'),
              stairType: 'STRAIGHT',
              widthMm: 900,
              riserCount: 16,
              treadDepthMm: 270,
              path: {
                points: [
                  { x: 0, y: 0 },
                  { x: 15 * 270, y: 0 },
                ],
              },
            },
          ],
          roofStructures: [
            {
              id: entityId('roof-whole'),
              type: 'ROOF',
              levelId: ground.id,
              footprint: {
                outer: [
                  { x: 0, y: 0 },
                  { x: 10_000, y: 0 },
                  { x: 10_000, y: 8000 },
                  { x: 0, y: 8000 },
                ],
              },
              edges: Array.from({ length: 4 }, () => ({
                kind: 'SLOPED' as const,
                slopeDeg: 35,
                overhangMm: 400,
              })),
              assemblyId: assemblyId('assembly-horizontal'),
              baseElevationMm: 2500,
            },
          ],
          structure: [
            {
              id: entityId('member-column'),
              type: 'STRUCTURAL_MEMBER',
              levelId: ground.id,
              kind: 'COLUMN',
              path: [{ x: 2000, y: 2000 }],
              widthMm: 200,
              depthMm: 200,
              heightMm: 2500,
            },
          ],
          components: [
            {
              id: entityId('component-radiator'),
              type: 'COMPONENT_INSTANCE',
              levelId: ground.id,
              category: 'HEATING',
              name: 'Radiateur séjour',
              position: { x: 3000, y: 1000 },
              elevationMm: 300,
              rotationDeg: 0,
            },
          ],
        },
        {
          ...ground,
          id: entityId('upper'),
          name: 'Étage',
          elevationMm: 2700,
          walls: [],
          slabs: [],
          roofs: [],
          openings: [],
          spaces: [],
          annotations: [],
          stairs: [],
          roofStructures: [],
          structure: [],
          components: [],
        },
        {
          ...ground,
          id: entityId('attic'),
          name: 'Combles',
          elevationMm: 5400,
          walls: [],
          slabs: [],
          roofs: [],
          openings: [],
          spaces: [],
          annotations: [],
          stairs: [],
          roofStructures: [],
          structure: [],
          components: [],
        },
      ],
    },
  };
  return { ...source, project };
}

function apply(source: ProjectFile, command: ProjectCommand): Project {
  const dispatcher = new ProjectCommandDispatcher(source.project);
  const outcome = dispatcher.dispatch(command);
  if (outcome.status !== 'APPLIED')
    throw new Error(
      outcome.status === 'REJECTED' ? outcome.errors.join(' ') : outcome.status,
    );
  return dispatcher.project;
}

const PARCEL = [
  { x: -5000, y: -5000 },
  { x: 20_000, y: -5000 },
  { x: 20_000, y: 18_000 },
  { x: -5000, y: 18_000 },
];

/** Every family that moves, and one of its objects in the populated house. */
const MOVES = [
  ['un mur', 'wall-south'],
  ['une dalle', 'slab-ground'],
  ['un escalier', 'stair-main'],
  ['une toiture complète', 'roof-whole'],
  ['un poteau', 'member-column'],
  ['un composant', 'component-radiator'],
  ['un obstacle de terrain', 'obstacle-tree'],
] as const;

describe('what each family says it can do', () => {
  it.each(MOVES)('carries %s across the plan', (_what, objectId) => {
    const source = populated();
    const before = boundsOf(source.project, 'ground', objectId)!;
    const result = moveObjectsCommand(source, 'ground', [objectId], {
      x: 1000,
      y: 500,
    });
    if (result.status !== 'OK') throw new Error(result.message);
    const after = boundsOf(apply(source, result.command), 'ground', objectId)!;
    expect(after.min.x - before.min.x).toBeCloseTo(1000, 6);
    expect(after.min.y - before.min.y).toBeCloseTo(500, 6);
  });

  it.each(MOVES)('turns %s a quarter turn', (_what, objectId) => {
    const source = populated();
    const result = transformObjectsCommand(source, 'ground', [objectId], {
      kind: 'ROTATE',
      centre: { x: 0, y: 0 },
      angleDeg: 90,
    });
    if (result.status !== 'OK') throw new Error(result.message);
    expect(() => apply(source, result.command)).not.toThrow();
  });

  it.each(MOVES)('reflects %s across an axis', (_what, objectId) => {
    const source = populated();
    const result = transformObjectsCommand(source, 'ground', [objectId], {
      kind: 'MIRROR',
      from: { x: 0, y: 0 },
      to: { x: 0, y: 1000 },
    });
    if (result.status !== 'OK') throw new Error(result.message);
    expect(() => apply(source, result.command)).not.toThrow();
  });

  it.each(MOVES)('copies %s a little to the side', (_what, objectId) => {
    const source = populated();
    const result = duplicateObjectsCommand(
      source,
      'ground',
      [objectId],
      { x: 2000, y: 0 },
      (prefix) => `${prefix}-copy`,
    );
    if (result.status !== 'OK') throw new Error(result.message);
    expect(result.createdIds).toHaveLength(1);
    const project = apply(source, result.command);
    const copy = boundsOf(project, 'ground', result.createdIds[0]!)!;
    const original = boundsOf(source.project, 'ground', objectId)!;
    expect(copy.min.x - original.min.x).toBeCloseTo(2000, 6);
  });
});

describe('what a family says it does not do', () => {
  it('declares an opening as duplicable but never movable on its own', () => {
    expect(capabilitiesOf(file().project, 'opening-entry')).toEqual({
      movable: false,
      rotatable: false,
      mirrorable: false,
      duplicable: true,
    });
  });

  it('declares a room as following its walls, in all four verbs', () => {
    expect(capabilitiesOf(file().project, 'space-living')).toEqual({
      movable: false,
      rotatable: false,
      mirrorable: false,
      duplicable: false,
    });
  });

  it('says nothing can be done to an identifier the project does not hold', () => {
    expect(capabilitiesOf(file().project, 'nowhere').movable).toBe(false);
  });

  it('lets a selection do only what all of it can do', () => {
    const source = populated();
    expect(selectionCapabilities(source.project, ['wall-south'])).toEqual({
      movable: true,
      rotatable: true,
      mirrorable: true,
      duplicable: true,
    });
    // One room in the selection and nothing turns: turning the walls around it
    // would take the drawing apart.
    expect(
      selectionCapabilities(source.project, ['wall-south', 'space-living'])
        .rotatable,
    ).toBe(false);
  });

  it('refuses a network object copied alone, and says where to copy it', () => {
    const result = duplicateObjectsCommand(
      file(),
      'ground',
      ['water:trunk'],
      { x: 100, y: 0 },
      (prefix) => `${prefix}-copy`,
    );
    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') return;
    expect(result.message).toContain('Réseaux');
  });

  it('refuses to carry a segment away from the nodes it joins', () => {
    const result = moveObjectsCommand(file(), 'ground', ['water:trunk'], {
      x: 100,
      y: 0,
    });
    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') return;
    expect(result.message).toContain('sélectionnez-les avec lui');
  });

  it('refuses to move the parcel, which is the limit of the ground', () => {
    const source = populated();
    const drawn = {
      ...source,
      project: apply(source, new SetParcelBoundaryCommand(PARCEL)),
    };
    expect(capabilitiesOf(drawn.project, 'site:parcel')).toEqual({
      movable: false,
      rotatable: false,
      mirrorable: false,
      duplicable: false,
    });
    const result = moveObjectsCommand(drawn, 'ground', ['site:parcel'], {
      x: 100,
      y: 0,
    });
    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') return;
    expect(result.message).toContain('déplacez le bâtiment');
  });

  it('moves an obstacle of the same family, which is not the parcel', () => {
    const source = populated();
    expect(capabilitiesOf(source.project, 'obstacle-tree').movable).toBe(true);
  });
});

describe('a whole run of network carried at once', () => {
  it('keeps its corners when its nodes travel with it', () => {
    const source = file();
    const network = (source.project.systems ?? []).find(
      ({ id }) => id === 'water',
    )!;
    const edge = network.edges.find(({ path }) => path.length > 2);
    if (edge === undefined) return;
    const nodeOfPort = new Map(
      network.ports.map((port) => [port.id, port.nodeId] as const),
    );
    const ends = [
      nodeOfPort.get(edge.fromPortId)!,
      nodeOfPort.get(edge.toPortId)!,
    ];
    const before = edge.path.map(({ x, y }) => ({ x, y }));
    const result = moveObjectsCommand(source, 'ground', [...ends, edge.id], {
      x: 1000,
      y: 0,
    });
    if (result.status !== 'OK') throw new Error(result.message);
    const project = apply(source, result.command);
    const after = (project.systems ?? [])
      .flatMap(({ edges }) => edges)
      .find(({ id }) => id === edge.id)!;
    for (const [index, point] of after.path.entries())
      expect(point.x - before[index]!.x).toBeCloseTo(1000, 6);
  });
});

describe('a storey copied onto the one above it', () => {
  const EVERYTHING = [
    'wall-south',
    'slab-ground',
    'stair-main',
    'roof-whole',
    'member-column',
    'component-radiator',
  ];

  it('takes every family, not only the ones the clipboard knew', () => {
    const taken = copyObjects(populated(), 'ground', EVERYTHING);
    expect(clipboardCount(taken)).toBe(EVERYTHING.length);
    expect(taken.stairs).toHaveLength(1);
    expect(taken.roofStructures).toHaveLength(1);
    expect(taken.structure).toHaveLength(1);
    expect(taken.components).toHaveLength(1);
  });

  it('puts them all down on the storey above', () => {
    const source = populated();
    const taken = copyObjects(source, 'ground', EVERYTHING);
    const result = pasteClipboardCommand(
      source,
      'upper',
      taken,
      { x: 0, y: 0 },
      (prefix) => `${prefix}-pasted`,
    );
    if (result.status !== 'OK') throw new Error(result.message);
    const upper = apply(source, result.command).building.levels.find(
      ({ id }) => id === 'upper',
    )!;
    expect(upper.walls).toHaveLength(1);
    expect(upper.slabs).toHaveLength(1);
    expect(upper.stairs).toHaveLength(1);
    expect(upper.roofStructures).toHaveLength(1);
    expect(upper.structure).toHaveLength(1);
    expect(upper.components).toHaveLength(1);
  });

  it('raises what knows its own altitude by the height of the storey', () => {
    const source = populated();
    const taken = copyObjects(source, 'ground', ['roof-whole']);
    const result = pasteClipboardCommand(
      source,
      'upper',
      taken,
      { x: 0, y: 0 },
      (prefix) => `${prefix}-pasted`,
    );
    if (result.status !== 'OK') throw new Error(result.message);
    const roof = apply(source, result.command).building.levels.find(
      ({ id }) => id === 'upper',
    )!.roofStructures![0]!;
    // The eaves were at 2500 on a storey at 0; on a storey at 2700 they are at
    // 5200, not back down where they came from.
    expect(roof.baseElevationMm).toBe(2500 + 2700);
  });

  it('sends a pasted stair one storey higher than the one it came from', () => {
    const source = populated();
    const taken = copyObjects(source, 'ground', ['stair-main']);
    const result = pasteClipboardCommand(
      source,
      'upper',
      taken,
      { x: 0, y: 0 },
      (prefix) => `${prefix}-pasted`,
    );
    if (result.status !== 'OK') throw new Error(result.message);
    const stair = apply(source, result.command).building.levels.find(
      ({ id }) => id === 'upper',
    )!.stairs[0]!;
    // It joined the ground floor to the first; pasted on the first it joins
    // the first to the attic, and not the first back down to itself.
    expect(stair.topLevelId).toBe('attic');
  });

  it('refuses a stair that would have nowhere left to climb', () => {
    // Pasted onto the top storey, the stair's arrival would be a storey the
    // project does not have. A stair that goes nowhere is not pasted quietly.
    const source = populated();
    const taken = copyObjects(source, 'ground', ['stair-main']);
    const result = pasteClipboardCommand(
      source,
      'attic',
      taken,
      { x: 0, y: 0 },
      (prefix) => `${prefix}-pasted`,
    );
    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') return;
    expect(result.message).toContain('n’y monterait pas');
  });
});
