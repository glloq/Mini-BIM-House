import { describe, expect, it } from 'vitest';
import { entityId } from './ids.js';
import type { Level, Project } from './types.js';
import type { Space } from './space.js';
import type { Wall } from './wall.js';
import {
  resolveSpaceGeometry,
  resolveWallGeometry,
  resolveWallHeightMm,
  resolvedSpaces,
  wallLengthM,
} from './resolved-geometry.js';

const ground = entityId<'Level'>('ground');
const first = entityId<'Level'>('first');
const assembly = 'assembly-exterior' as never;

function wall(
  id: string,
  points: readonly { x: number; y: number }[],
  rest: Partial<Wall> = {},
): Wall {
  return {
    id: entityId<'Wall'>(id),
    type: 'WALL',
    levelId: ground,
    path: { points },
    referenceSide: 'CENTER',
    assemblyId: assembly,
    baseOffsetMm: 0,
    role: 'EXTERIOR',
    heightMode: 'EXPLICIT',
    heightMm: 2500,
    ...rest,
  } as Wall;
}

/** Four walls enclosing ten metres by eight, and a partition down the middle. */
function walls(): readonly Wall[] {
  return [
    wall('wall-south', [
      { x: 0, y: 0 },
      { x: 10_000, y: 0 },
    ]),
    wall('wall-east', [
      { x: 10_000, y: 0 },
      { x: 10_000, y: 8000 },
    ]),
    wall('wall-north', [
      { x: 10_000, y: 8000 },
      { x: 0, y: 8000 },
    ]),
    wall('wall-west', [
      { x: 0, y: 8000 },
      { x: 0, y: 0 },
    ]),
    wall(
      'wall-partition',
      [
        { x: 5000, y: 0 },
        { x: 5000, y: 8000 },
      ],
      { role: 'INTERIOR' },
    ),
  ];
}

function level(overrides: Partial<Level> = {}): Level {
  return {
    id: ground,
    name: 'RDC',
    elevationMm: 0,
    defaultStoreyHeightMm: 2500,
    walls: walls(),
    openings: [],
    slabs: [],
    roofs: [],
    spaces: [],
    stairs: [],
    annotations: [],
    ...overrides,
  };
}

function project(levels: readonly Level[]): Project {
  return {
    id: entityId<'Project'>('geometry-fixture'),
    metadata: {
      name: 'Geometry',
      createdAt: '2026-08-22T00:00:00Z',
      updatedAt: '2026-08-22T00:00:00Z',
    },
    site: { northAngleDeg: 0 },
    building: { levels, zones: [] },
  };
}

function auto(anchor?: { x: number; y: number }): Space {
  return {
    id: entityId<'Space'>('space-west'),
    type: 'SPACE',
    levelId: ground,
    name: 'Séjour',
    category: 'LIVING',
    boundaryMode: 'AUTO',
    ...(anchor === undefined ? {} : { anchor }),
  };
}

describe('how high a wall stands', () => {
  it('takes the height a wall states', () => {
    expect(resolveWallHeightMm(project([level()]), walls()[0]!)).toBe(2500);
  });

  it('measures a wall built up to a storey', () => {
    // A wall built to the floor above used to be skipped entirely: the
    // envelope the calculation saw had fewer walls than the plan.
    const upTo = wall(
      'wall-tall',
      [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
      ],
      { heightMode: 'TO_LEVEL', topLevelId: first, topOffsetMm: 200 },
    );
    const source = project([
      level({ walls: [upTo] }),
      { ...level(), id: first, name: 'Étage', elevationMm: 2900, walls: [] },
    ]);
    expect(resolveWallHeightMm(source, upTo)).toBe(3100);
    const resolved = resolveWallGeometry(
      source,
      upTo,
      source.building.levels[0]!,
    );
    expect(resolved.source).toBe('DERIVED');
    expect(resolved.grossAreaM2).toBeCloseTo(4 * 3.1, 9);
    expect(resolved.topElevationMm).toBe(3100);
  });

  it('counts the base offset out of the height it climbs', () => {
    const raised = wall(
      'wall-raised',
      [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
      ],
      { heightMode: 'TO_LEVEL', topLevelId: first, baseOffsetMm: 400 },
    );
    const source = project([
      level({ walls: [raised] }),
      { ...level(), id: first, name: 'Étage', elevationMm: 2900, walls: [] },
    ]);
    expect(resolveWallHeightMm(source, raised)).toBe(2500);
    expect(
      resolveWallGeometry(source, raised, source.building.levels[0]!)
        .baseElevationMm,
    ).toBe(400);
  });

  it('says so rather than guessing when the storey above is not there', () => {
    const dangling = wall(
      'wall-nowhere',
      [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
      ],
      { heightMode: 'TO_LEVEL', topLevelId: entityId<'Level'>('attic') },
    );
    const source = project([level({ walls: [dangling] })]);
    const resolved = resolveWallGeometry(
      source,
      dangling,
      source.building.levels[0]!,
    );
    expect(resolved.source).toBe('UNRESOLVED');
    expect(resolved.grossAreaM2).toBeUndefined();
    expect(resolved.unresolved).toContain('attic');
  });

  it('measures the path a wall is drawn along, corner by corner', () => {
    expect(
      wallLengthM(
        wall('wall-bent', [
          { x: 0, y: 0 },
          { x: 3000, y: 0 },
          { x: 3000, y: 4000 },
        ]),
      ),
    ).toBeCloseTo(7, 9);
  });

  it('takes the openings out of the wall they are cut through', () => {
    const source = project([
      level({
        openings: [
          {
            id: entityId<'Opening'>('window'),
            type: 'OPENING',
            openingType: 'WINDOW',
            hostElementId: entityId<'Wall'>('wall-south'),
            offsetAlongHostMm: 1000,
            sillHeightMm: 900,
            widthMm: 2000,
            heightMm: 1000,
          },
        ],
      }),
    ]);
    const resolved = resolveWallGeometry(
      source,
      source.building.levels[0]!.walls[0]!,
      source.building.levels[0]!,
    );
    expect(resolved.grossAreaM2).toBeCloseTo(25, 9);
    expect(resolved.openingAreaM2).toBeCloseTo(2, 9);
    expect(resolved.netAreaM2).toBeCloseTo(23, 9);
    expect(resolved.openingIds).toEqual(['window']);
  });
});

describe('what surface a room has', () => {
  it('takes the outline a room states', () => {
    const stated: Space = {
      id: entityId<'Space'>('space-stated'),
      type: 'SPACE',
      levelId: ground,
      name: 'Cuisine',
      category: 'KITCHEN',
      boundaryMode: 'MANUAL',
      manualPolygon: {
        outer: [
          { x: 0, y: 0 },
          { x: 4000, y: 0 },
          { x: 4000, y: 3000 },
          { x: 0, y: 3000 },
        ],
      },
    };
    const resolved = resolveSpaceGeometry(stated, level());
    expect(resolved.source).toBe('STATED');
    expect(resolved.floorAreaM2).toBeCloseTo(12, 9);
    expect(resolved.perimeterM).toBeCloseTo(14, 9);
    expect(resolved.volumeM3).toBeCloseTo(30, 9);
  });

  it('works a room out from the walls that enclose it', () => {
    // A room drawn by its walls used to reach every calculation with no
    // surface, no perimeter and no volume: visible on the plan, absent from
    // the heating, the air, the light and the acoustics.
    const resolved = resolveSpaceGeometry(auto({ x: 2500, y: 4000 }), level());
    expect(resolved.source).toBe('DERIVED');
    // The western half: five metres by eight.
    expect(resolved.floorAreaM2).toBeCloseTo(40, 6);
    expect(resolved.volumeM3).toBeCloseTo(100, 6);
  });

  it('picks the enclosure the room stands in, not the first one found', () => {
    const west = resolveSpaceGeometry(auto({ x: 2500, y: 4000 }), level());
    const east = resolveSpaceGeometry(auto({ x: 7500, y: 4000 }), level());
    expect(west.polygon).not.toEqual(east.polygon);
    expect(east.floorAreaM2).toBeCloseTo(40, 6);
  });

  it('says a room that does not say where it is cannot be measured', () => {
    // Six rooms detect six faces and no rule pairs them; picking the first
    // would give a house a surface nobody drew.
    const resolved = resolveSpaceGeometry(auto(), level());
    expect(resolved.source).toBe('UNRESOLVED');
    expect(resolved.floorAreaM2).toBeUndefined();
    expect(resolved.unresolved).toContain('Séjour');
  });

  it('says so when no wall encloses the point the room names', () => {
    const resolved = resolveSpaceGeometry(
      auto({ x: 90_000, y: 90_000 }),
      level(),
    );
    expect(resolved.source).toBe('UNRESOLVED');
    expect(resolved.unresolved).toContain('Aucun enclos');
  });

  it('gives the same answer for every room of the project at once', () => {
    const source = project([level({ spaces: [auto({ x: 2500, y: 4000 })] })]);
    expect(
      resolvedSpaces(source).map(({ floorAreaM2 }) => floorAreaM2),
    ).toEqual([
      resolveSpaceGeometry(auto({ x: 2500, y: 4000 }), level()).floorAreaM2,
    ]);
  });
});
