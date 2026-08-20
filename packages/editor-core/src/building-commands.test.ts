import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import { entityId } from '@house-technical-designer/core-domain';
import {
  genericMaterial,
  materialId,
} from '@house-technical-designer/materials';
import { ProjectCommandDispatcher } from './project-commands.js';
import { draftAssembly, draftAssemblyLayer } from './library-commands.js';
import {
  AddLevelCommand,
  AddRoofCommand,
  AddSlabCommand,
  AddSpaceCommand,
  DuplicateLevelCommand,
  RemoveLevelCommand,
  RemoveRoofCommand,
  RemoveSlabCommand,
  RemoveSpaceCommand,
  UpdateLevelCommand,
  UpdateSpaceCommand,
  detectRooms,
} from './building-commands.js';

const CONCRETE = materialId('generic-concrete');
const ground = entityId<'Level'>('ground');

function square(size: number) {
  return {
    outer: [
      { x: 0, y: 0 },
      { x: size, y: 0 },
      { x: size, y: size },
      { x: 0, y: size },
    ],
  };
}

function wall(
  id: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  return {
    id: entityId<'Wall'>(id),
    type: 'WALL' as const,
    levelId: ground,
    path: { points: [from, to] },
    referenceSide: 'CENTER' as const,
    assemblyId: 'wall-assembly' as never,
    baseOffsetMm: 0,
    heightMode: 'EXPLICIT' as const,
    heightMm: 2500,
    role: 'EXTERIOR' as const,
  };
}

function project(): Project {
  return {
    id: entityId<'Project'>('building-fixture'),
    metadata: {
      name: 'Building fixture',
      createdAt: '2026-08-19T00:00:00Z',
      updatedAt: '2026-08-19T00:00:00Z',
    },
    site: { northAngleDeg: 0 },
    materialLibrary: { materials: [genericMaterial(CONCRETE)!] },
    assemblies: [
      draftAssembly('wall-assembly', 'Mur', 'WALL', [
        draftAssemblyLayer('wall-layer', CONCRETE, 200, 'STRUCTURAL'),
      ]),
      draftAssembly('floor-assembly', 'Plancher', 'FLOOR', [
        draftAssemblyLayer('floor-layer', CONCRETE, 180, 'STRUCTURAL'),
      ]),
      draftAssembly('roof-assembly', 'Toiture', 'ROOF', [
        draftAssemblyLayer('roof-layer', CONCRETE, 220, 'STRUCTURAL'),
      ]),
    ],
    building: {
      levels: [
        {
          id: ground,
          name: 'RDC',
          elevationMm: 0,
          defaultStoreyHeightMm: 2500,
          walls: [
            wall('south', { x: 0, y: 0 }, { x: 5000, y: 0 }),
            wall('east', { x: 5000, y: 0 }, { x: 5000, y: 4000 }),
            wall('north', { x: 5000, y: 4000 }, { x: 0, y: 4000 }),
            wall('west', { x: 0, y: 4000 }, { x: 0, y: 0 }),
          ],
          openings: [],
          slabs: [],
          roofs: [],
          spaces: [],
          stairs: [],
          annotations: [],
        },
      ],
      zones: [],
    },
  };
}

function dispatcher(): ProjectCommandDispatcher {
  return new ProjectCommandDispatcher(project());
}

describe('level commands', () => {
  it('adds a level and keeps the storeys ordered by elevation', () => {
    const commands = dispatcher();
    expect(
      commands.dispatch(
        new AddLevelCommand({
          id: 'basement',
          name: 'Sous-sol',
          elevationMm: -2600,
          defaultStoreyHeightMm: 2400,
        }),
      ).status,
    ).toBe('APPLIED');
    expect(commands.project.building.levels.map(({ id }) => id)).toEqual([
      'basement',
      'ground',
    ]);
  });

  it('rejects a level with an impossible height or a duplicate identifier', () => {
    const commands = dispatcher();
    expect(
      commands.dispatch(
        new AddLevelCommand({
          id: 'first',
          name: 'R+1',
          elevationMm: 2600,
          defaultStoreyHeightMm: 0,
        }),
      ).status,
    ).toBe('REJECTED');
    expect(
      commands.dispatch(
        new AddLevelCommand({
          id: 'ground',
          name: 'Doublon',
          elevationMm: 5000,
          defaultStoreyHeightMm: 2500,
        }),
      ).status,
    ).toBe('REJECTED');
  });

  it('duplicates a level with its walls, openings and spaces renamed', () => {
    const commands = dispatcher();
    commands.dispatch(
      new AddSpaceCommand('ground', {
        id: 'living',
        name: 'Séjour',
        category: 'LIVING',
        polygon: square(4000),
      }),
    );
    expect(
      commands.dispatch(
        new DuplicateLevelCommand('ground', {
          id: 'first',
          name: 'R+1',
          elevationMm: 2600,
          defaultStoreyHeightMm: 2500,
        }),
      ).status,
    ).toBe('APPLIED');
    const first = commands.project.building.levels.find(
      ({ id }) => id === 'first',
    )!;
    expect(first.walls.map(({ id }) => id)).toEqual([
      'south@first',
      'east@first',
      'north@first',
      'west@first',
    ]);
    expect(first.spaces[0]?.id).toBe('living@first');
    expect(first.walls.every(({ levelId }) => levelId === 'first')).toBe(true);
  });

  it('updates a level and re-sorts the storeys', () => {
    const commands = dispatcher();
    commands.dispatch(
      new AddLevelCommand({
        id: 'first',
        name: 'R+1',
        elevationMm: 2600,
        defaultStoreyHeightMm: 2500,
      }),
    );
    expect(
      commands.dispatch(new UpdateLevelCommand('first', { elevationMm: -3000 }))
        .status,
    ).toBe('APPLIED');
    expect(commands.project.building.levels.map(({ id }) => id)).toEqual([
      'first',
      'ground',
    ]);
  });

  it('refuses to delete a level that still holds objects, or the last one', () => {
    const commands = dispatcher();
    commands.dispatch(
      new AddLevelCommand({
        id: 'first',
        name: 'R+1',
        elevationMm: 2600,
        defaultStoreyHeightMm: 2500,
      }),
    );
    const populated = commands.dispatch(new RemoveLevelCommand('ground'));
    expect(populated.status).toBe('REJECTED');
    if (populated.status === 'REJECTED')
      expect(populated.errors[0]).toContain('4 objet');
    expect(commands.dispatch(new RemoveLevelCommand('first')).status).toBe(
      'APPLIED',
    );
    expect(commands.dispatch(new RemoveLevelCommand('ground')).status).toBe(
      'REJECTED',
    );
  });
});

describe('space commands', () => {
  it('creates, renames and deletes a space', () => {
    const commands = dispatcher();
    expect(
      commands.dispatch(
        new AddSpaceCommand('ground', {
          id: 'living',
          name: 'Séjour',
          category: 'LIVING',
          polygon: square(4000),
        }),
      ).status,
    ).toBe('APPLIED');
    expect(
      commands.dispatch(
        new UpdateSpaceCommand('ground', 'living', { name: 'Salon' }),
      ).status,
    ).toBe('APPLIED');
    expect(commands.project.building.levels[0]!.spaces[0]!.name).toBe('Salon');
    expect(
      commands.dispatch(new RemoveSpaceCommand('ground', 'living')).status,
    ).toBe('APPLIED');
  });

  it('rejects a space without a name or with too few vertices', () => {
    const commands = dispatcher();
    expect(
      commands.dispatch(
        new AddSpaceCommand('ground', {
          id: 'x',
          name: '  ',
          category: 'LIVING',
          polygon: square(4000),
        }),
      ).status,
    ).toBe('REJECTED');
    expect(
      commands.dispatch(
        new AddSpaceCommand('ground', {
          id: 'y',
          name: 'Trop court',
          category: 'LIVING',
          polygon: { outer: [{ x: 0, y: 0 }] },
        }),
      ).status,
    ).toBe('REJECTED');
  });

  it('refuses to delete a space a zone still lists', () => {
    const commands = new ProjectCommandDispatcher({
      ...project(),
      building: {
        ...project().building,
        zones: [
          {
            id: entityId<'Zone'>('heated'),
            type: 'THERMAL',
            name: 'Zone chauffée',
            spaceIds: [entityId<'Space'>('living')],
            properties: {},
          },
        ],
      },
    });
    commands.dispatch(
      new AddSpaceCommand('ground', {
        id: 'living',
        name: 'Séjour',
        category: 'LIVING',
        polygon: square(4000),
      }),
    );
    const result = commands.dispatch(
      new RemoveSpaceCommand('ground', 'living'),
    );
    expect(result.status).toBe('REJECTED');
    if (result.status === 'REJECTED')
      expect(result.errors[0]).toContain('Zone chauffée');
  });
});

describe('room detection', () => {
  it('proposes the rooms the walls enclose, largest first', () => {
    const rooms = detectRooms(project(), 'ground');
    expect(rooms.length).toBeGreaterThan(0);
    expect(rooms[0]!.areaM2).toBeCloseTo(20, 6);
    expect(rooms[0]!.sourceWallIds.length).toBe(4);
    expect(rooms[0]!.existingSpaceId).toBeUndefined();
  });

  it('reports a boundary a space already covers rather than duplicating it', () => {
    const commands = dispatcher();
    commands.dispatch(
      new AddSpaceCommand('ground', {
        id: 'living',
        name: 'Séjour',
        category: 'LIVING',
        polygon: square(5000),
      }),
    );
    const rooms = detectRooms(commands.project, 'ground');
    expect(rooms[0]?.existingSpaceId).toBe('living');
  });

  it('returns nothing for an unknown level or a level without closed walls', () => {
    expect(detectRooms(project(), 'nowhere')).toEqual([]);
    const open = project();
    const level = open.building.levels[0]!;
    expect(
      detectRooms(
        {
          ...open,
          building: {
            ...open.building,
            levels: [{ ...level, walls: [level.walls[0]!] }],
          },
        },
        'ground',
      ),
    ).toEqual([]);
  });
});

describe('slab and roof commands', () => {
  it('adds a slab and refuses an assembly of the wrong category', () => {
    const commands = dispatcher();
    expect(
      commands.dispatch(
        new AddSlabCommand('ground', {
          id: 'slab',
          polygon: square(5000),
          assemblyId: 'floor-assembly',
          role: 'FLOOR',
          elevationOffsetMm: 0,
        }),
      ).status,
    ).toBe('APPLIED');
    const wrong = commands.dispatch(
      new AddSlabCommand('ground', {
        id: 'slab-2',
        polygon: square(5000),
        assemblyId: 'wall-assembly',
        role: 'FLOOR',
        elevationOffsetMm: 0,
      }),
    );
    expect(wrong.status).toBe('REJECTED');
    if (wrong.status === 'REJECTED') expect(wrong.errors[0]).toContain('WALL');
    expect(
      commands.dispatch(new RemoveSlabCommand('ground', 'slab')).status,
    ).toBe('APPLIED');
  });

  it('adds a roof plane and checks its slope and azimuth', () => {
    const commands = dispatcher();
    expect(
      commands.dispatch(
        new AddRoofCommand('ground', {
          id: 'roof',
          footprint: square(5000),
          assemblyId: 'roof-assembly',
          slopeDeg: 30,
          azimuthDeg: 180,
          baseElevationMm: 2500,
        }),
      ).status,
    ).toBe('APPLIED');
    expect(
      commands.dispatch(
        new AddRoofCommand('ground', {
          id: 'roof-2',
          footprint: square(5000),
          assemblyId: 'roof-assembly',
          slopeDeg: 95,
          azimuthDeg: 180,
          baseElevationMm: 2500,
        }),
      ).status,
    ).toBe('REJECTED');
    expect(
      commands.dispatch(
        new AddRoofCommand('ground', {
          id: 'roof-3',
          footprint: square(5000),
          assemblyId: 'roof-assembly',
          slopeDeg: 30,
          azimuthDeg: 400,
          baseElevationMm: 2500,
        }),
      ).status,
    ).toBe('REJECTED');
    expect(
      commands.dispatch(new RemoveRoofCommand('ground', 'roof')).status,
    ).toBe('APPLIED');
  });

  it('undoes a building edit back to the previous project', () => {
    const commands = dispatcher();
    commands.dispatch(
      new AddSlabCommand('ground', {
        id: 'slab',
        polygon: square(5000),
        assemblyId: 'floor-assembly',
        role: 'FLOOR',
        elevationOffsetMm: 0,
      }),
    );
    expect(commands.project.building.levels[0]!.slabs).toHaveLength(1);
    expect(commands.undo().status).toBe('APPLIED');
    expect(commands.project.building.levels[0]!.slabs).toHaveLength(0);
  });
});

describe('levels and the annotations they carry', () => {
  function withDimension(): Project {
    const base = project();
    const level = base.building.levels[0]!;
    return {
      ...base,
      building: {
        ...base.building,
        levels: [
          {
            ...level,
            annotations: [
              {
                id: 'width' as never,
                kind: 'DIMENSION' as const,
                type: 'ALIGNED' as const,
                first: {
                  kind: 'WALL_ENDPOINT' as const,
                  wallId: entityId<'Wall'>('south'),
                  endpoint: 'START' as const,
                },
                second: {
                  kind: 'WALL_ENDPOINT' as const,
                  wallId: entityId<'Wall'>('south'),
                  endpoint: 'END' as const,
                },
                offsetMm: 800,
              },
            ],
          },
          {
            ...level,
            id: entityId<'Level'>('upper'),
            name: 'Étage',
            elevationMm: 2500,
            walls: [],
            annotations: [],
          },
        ],
      },
    };
  }

  it('refuses to delete a level whose only content is a dimension', () => {
    const base = withDimension();
    const empty = {
      ...base,
      building: {
        ...base.building,
        levels: base.building.levels.map((level) =>
          level.id === ground ? { ...level, walls: [] } : level,
        ),
      },
    };
    const dispatcher = new ProjectCommandDispatcher(empty);
    const result = dispatcher.dispatch(new RemoveLevelCommand(ground));
    expect(result.status).toBe('REJECTED');
    if (result.status === 'REJECTED')
      expect(result.errors[0]).toContain('1 objet');
  });

  it('carries the dimensions of a duplicated level onto its copied walls', () => {
    const dispatcher = new ProjectCommandDispatcher(withDimension());
    expect(
      dispatcher.dispatch(
        new DuplicateLevelCommand(ground, {
          id: 'copy',
          name: 'Copie',
          elevationMm: 5000,
          defaultStoreyHeightMm: 2500,
        }),
      ).status,
    ).toBe('APPLIED');
    const copy = dispatcher.project.building.levels.find(
      ({ id }) => id === 'copy',
    )!;
    expect(copy.annotations).toHaveLength(1);
    // The copy measures its own walls, not the ones it was copied from.
    expect(copy.annotations[0]!.first.wallId).toBe('south@copy');
    expect(copy.annotations[0]!.second.wallId).toBe('south@copy');
    expect(copy.walls.some(({ id }) => id === 'south@copy')).toBe(true);
  });
});
