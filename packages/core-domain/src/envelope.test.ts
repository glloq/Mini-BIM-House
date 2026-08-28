import { describe, expect, it } from 'vitest';
import { entityId } from './ids.js';
import type { Level, Project } from './types.js';
import { resolveEnvelope, envelopeAreaM2 } from './envelope.js';

const ground = entityId<'Level'>('ground');
const first = entityId<'Level'>('first');

function level(id: typeof ground, overrides: Partial<Level> = {}): Level {
  return {
    id,
    name: 'Niveau',
    elevationMm: 0,
    defaultStoreyHeightMm: 2500,
    walls: [],
    openings: [],
    slabs: [],
    roofs: [],
    spaces: [],
    stairs: [],
    annotations: [],
    ...overrides,
  };
}

const square = {
  outer: [
    { x: 0, y: 0 },
    { x: 10_000, y: 0 },
    { x: 10_000, y: 8000 },
    { x: 0, y: 8000 },
  ],
};

function house(overrides: Partial<Level> = {}): Project {
  return {
    id: entityId<'Project'>('envelope-fixture'),
    metadata: {
      name: 'Envelope',
      createdAt: '2026-08-22T00:00:00Z',
      updatedAt: '2026-08-22T00:00:00Z',
    },
    site: { northAngleDeg: 0 },
    building: {
      levels: [
        level(ground, {
          walls: [
            {
              id: entityId<'Wall'>('wall-south'),
              type: 'WALL',
              levelId: ground,
              path: {
                points: [
                  { x: 0, y: 0 },
                  { x: 10_000, y: 0 },
                ],
              },
              referenceSide: 'CENTER',
              assemblyId: 'assembly-exterior' as never,
              baseOffsetMm: 0,
              heightMode: 'EXPLICIT',
              heightMm: 2500,
              role: 'EXTERIOR',
            },
            {
              id: entityId<'Wall'>('wall-partition'),
              type: 'WALL',
              levelId: ground,
              path: {
                points: [
                  { x: 5000, y: 0 },
                  { x: 5000, y: 8000 },
                ],
              },
              referenceSide: 'CENTER',
              assemblyId: 'assembly-partition' as never,
              baseOffsetMm: 0,
              heightMode: 'EXPLICIT',
              heightMm: 2500,
              role: 'INTERIOR',
            },
          ],
          openings: [
            {
              id: entityId<'Opening'>('window'),
              type: 'OPENING',
              openingType: 'WINDOW',
              host: { kind: 'WALL', id: entityId<'Wall'>('wall-south') },
              offsetAlongHostMm: 1000,
              sillHeightMm: 900,
              widthMm: 2000,
              heightMm: 2000,
              definitionId: 'generic-window',
            },
          ],
          slabs: [
            {
              id: entityId<'Slab'>('slab-ground'),
              type: 'SLAB',
              levelId: ground,
              polygon: square,
              assemblyId: 'assembly-horizontal' as never,
              elevationOffsetMm: 0,
              role: 'FLOOR',
            },
          ],
          roofs: [
            {
              id: entityId<'RoofPlane'>('roof'),
              type: 'ROOF_PLANE',
              levelId: ground,
              footprint: square,
              assemblyId: 'assembly-horizontal' as never,
              slopeDeg: 0,
              azimuthDeg: 180,
              baseElevationMm: 2500,
            },
          ],
          ...overrides,
        }),
      ],
      zones: [],
    },
  };
}

function kinds(project: Project): readonly string[] {
  return resolveEnvelope(project)
    .map(({ kind }) => kind)
    .sort();
}

describe('what separates the house from the outside', () => {
  it('holds the wall, the window, the roof and the floor', () => {
    // The thermal calculation was a list of exterior walls and nothing else:
    // the roof was resolved in the context and never reached the envelope,
    // and neither did the floors.
    expect(kinds(house())).toEqual([
      'FLOOR_GROUND',
      'ROOF',
      'WALL_OPAQUE',
      'WINDOW',
    ]);
  });

  it('puts the window back as a window, not as a hole', () => {
    // Twenty-five square metres of wall with four of glass used to reach the
    // calculation as twenty-one square metres of masonry and four square
    // metres of nothing.
    const elements = resolveEnvelope(house());
    const wall = elements.find(({ kind }) => kind === 'WALL_OPAQUE')!;
    const window = elements.find(({ kind }) => kind === 'WINDOW')!;
    expect(wall.grossAreaM2).toBeCloseTo(25, 9);
    expect(wall.netAreaM2).toBeCloseTo(21, 9);
    expect(window.netAreaM2).toBeCloseTo(4, 9);
    // And the two together are the whole wall again.
    expect(wall.netAreaM2! + window.netAreaM2!).toBeCloseTo(25, 9);
    // A window is bought whole; it names its model, not a build-up.
    expect(window.definitionId).toBe('generic-window');
    expect(window.assemblyId).toBeUndefined();
  });

  it('leaves the partition and its openings out', () => {
    // An interior wall separates two heated rooms; it is not the envelope.
    expect(
      resolveEnvelope(house()).some(
        ({ sourceEntityId }) => sourceEntityId === 'wall-partition',
      ),
    ).toBe(false);
  });

  it('says what is on the other side of each element', () => {
    const elements = resolveEnvelope(house());
    expect(
      elements.find(({ kind }) => kind === 'FLOOR_GROUND')?.boundaryCondition,
    ).toBe('GROUND');
    expect(
      elements.find(({ kind }) => kind === 'ROOF')?.boundaryCondition,
    ).toBe('EXTERIOR');
  });

  it('counts a roof by the surface it really has, not by its shadow', () => {
    const sloped = house();
    const plane = sloped.building.levels[0]!.roofs[0]!;
    const pitched = {
      ...sloped,
      building: {
        ...sloped.building,
        levels: [
          {
            ...sloped.building.levels[0]!,
            roofs: [{ ...plane, slopeDeg: 60 }],
          },
        ],
      },
    } as Project;
    const roof = resolveEnvelope(pitched).find(({ kind }) => kind === 'ROOF')!;
    // Eighty square metres in plan at sixty degrees is a hundred and sixty.
    expect(roof.netAreaM2).toBeCloseTo(160, 6);
  });

  it('does not count a floor between two heated storeys', () => {
    const source = house();
    const upstairs = {
      ...source,
      building: {
        ...source.building,
        levels: [
          source.building.levels[0]!,
          {
            ...level(first, {
              elevationMm: 2900,
              slabs: [
                {
                  id: entityId<'Slab'>('slab-first'),
                  type: 'SLAB',
                  levelId: first,
                  polygon: square,
                  assemblyId: 'assembly-horizontal' as never,
                  elevationOffsetMm: 0,
                  role: 'FLOOR',
                },
              ],
            }),
          },
        ],
      },
    } as Project;
    expect(
      resolveEnvelope(upstairs).some(
        ({ sourceEntityId }) => sourceEntityId === 'slab-first',
      ),
    ).toBe(false);
    // The one on the ground still sits on the ground.
    expect(
      resolveEnvelope(upstairs).find(
        ({ sourceEntityId }) => sourceEntityId === 'slab-ground',
      )?.boundaryCondition,
    ).toBe('GROUND');
  });

  it('keeps a wall whose height is unknown, and says so', () => {
    // Dropping it would make the envelope look complete with a wall missing.
    const source = house();
    const dangling = {
      ...source,
      building: {
        ...source.building,
        levels: [
          {
            ...source.building.levels[0]!,
            walls: source.building.levels[0]!.walls.map((wall) =>
              wall.role === 'EXTERIOR'
                ? {
                    ...wall,
                    heightMode: 'TO_LEVEL' as const,
                    topLevelId: entityId<'Level'>('attic'),
                  }
                : wall,
            ),
          },
        ],
      },
    } as Project;
    const wall = resolveEnvelope(dangling).find(
      ({ kind }) => kind === 'WALL_OPAQUE',
    )!;
    expect(wall.netAreaM2).toBeUndefined();
    expect(wall.unresolved).toContain('attic');
  });

  it('adds up only what it could measure', () => {
    // 21 of wall, 4 of window, 80 of roof, 80 of floor.
    expect(envelopeAreaM2(resolveEnvelope(house()))).toBeCloseTo(185, 6);
  });
});
