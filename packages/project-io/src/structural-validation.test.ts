import { describe, expect, it } from 'vitest';
import { loadProjectJson, serializeProjectFile } from './project-io.js';

const level = {
  id: 'ground',
  name: 'Ground',
  elevationMm: 0,
  defaultStoreyHeightMm: 2500,
  walls: [] as unknown[],
  slabs: [] as unknown[],
  roofs: [] as unknown[],
  openings: [] as unknown[],
  stairs: [] as unknown[],
  spaces: [] as unknown[],
  annotations: [] as unknown[],
};

function wall(id: string, levelId: string): Record<string, unknown> {
  return {
    id,
    type: 'WALL',
    levelId,
    assemblyId: 'assembly',
    path: {
      points: [
        { x: 0, y: 0 },
        { x: 5000, y: 0 },
      ],
    },
    referenceSide: 'CENTER',
    baseOffsetMm: 0,
    heightMode: 'EXPLICIT',
    heightMm: 2500,
    role: 'EXTERIOR',
  };
}

function space(id: string, levelId: string): Record<string, unknown> {
  return {
    id,
    type: 'SPACE',
    levelId,
    name: id,
    category: 'LIVING',
    boundaryMode: 'MANUAL',
    manualPolygon: {
      outer: [
        { x: 0, y: 0 },
        { x: 3000, y: 0 },
        { x: 3000, y: 3000 },
        { x: 0, y: 3000 },
      ],
    },
  };
}

function stair(
  id: string,
  levelId: string,
  topLevelId: string,
): Record<string, unknown> {
  return {
    id,
    type: 'STAIR',
    levelId,
    topLevelId,
    stairType: 'STRAIGHT',
    widthMm: 900,
    riserCount: 16,
    treadDepthMm: 270,
    path: {
      points: [
        { x: 0, y: 0 },
        { x: 4050, y: 0 },
      ],
    },
  };
}

function file(levels: readonly unknown[], extra: object = {}) {
  return {
    format: 'house-technical-designer-project' as const,
    schemaVersion: '1.1.0',
    project: {
      id: 'project',
      metadata: {
        name: 'House',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      site: { northAngleDeg: 0 },
      building: { levels, zones: [] },
      materialLibrary: {
        materials: [
          {
            id: 'material',
            name: 'Insulation',
            kind: 'GENERIC',
            properties: { lambdaWmK: 0.04 },
          },
        ],
      },
      assemblies: [
        {
          id: 'assembly',
          name: 'Wall assembly',
          category: 'WALL',
          layers: [{ id: 'layer', materialId: 'material', thicknessM: 0.2 }],
        },
      ],
      equipment: [],
      systems: [],
      scenarios: [],
      drawingViews: [],
      calculationSettings: {},
      regulatoryContext: { country: 'FR', enabledRulePacks: [] },
      ...extra,
    },
    references: {},
    extensions: {},
  };
}

function issues(candidate: object): readonly string[] {
  const result = loadProjectJson(JSON.stringify(candidate));
  return result.status === 'INVALID_PROJECT'
    ? result.issues.map(({ path, message }) => `${path} ${message}`)
    : [];
}

describe('structural validation of a project file', () => {
  it('accepts a coherent two-level project', () => {
    const ok = file([
      { ...level, walls: [wall('wall-ground', 'ground')] },
      {
        ...level,
        id: 'first',
        name: 'First',
        elevationMm: 2500,
        walls: [wall('wall-first', 'first')],
      },
    ]);
    expect(issues(ok)).toEqual([]);
    expect(() => serializeProjectFile(ok)).not.toThrow();
  });

  it('refuses an element stored on one level and declaring another', () => {
    // The wall exists and the level exists; what is wrong is where it is kept.
    const misplaced = file([
      { ...level, walls: [wall('wall-ground', 'first')] },
      { ...level, id: 'first', name: 'First', elevationMm: 2500 },
    ]);
    expect(issues(misplaced)).toEqual([
      '/project/building/levels/0/walls/0/levelId is stored on level ground but declares level first',
    ]);
  });

  it('refuses an opening hosted by a wall of another level', () => {
    const crossLevel = file([
      { ...level, walls: [wall('wall-ground', 'ground')] },
      {
        ...level,
        id: 'first',
        name: 'First',
        elevationMm: 2500,
        openings: [
          {
            id: 'window',
            type: 'OPENING',
            openingType: 'WINDOW',
            hostElementId: 'wall-ground',
            offsetAlongHostMm: 1000,
            sillHeightMm: 900,
            widthMm: 1200,
            heightMm: 1000,
          },
        ],
      },
    ]);
    expect(issues(crossLevel)).toEqual([
      '/project/building/levels/1/openings/0/hostElementId is stored on level first but hosted by wall wall-ground of another level',
    ]);
  });

  it('refuses a stair that arrives at a storey no higher than its own', () => {
    // The commands already refuse to draw one; a file can be written by
    // anything, and a stair with a rise of zero has no riser height, no
    // Blondel and no place in the quantities.
    const flat = file([
      { ...level, stairs: [stair('stair', 'ground', 'basement')] },
      { ...level, id: 'basement', name: 'Basement', elevationMm: -2500 },
    ]);
    expect(issues(flat)).toEqual([
      '/project/building/levels/0/stairs/0/topLevelId arrives at level basement, which is not above level ground',
    ]);
  });

  it('accepts a stair that climbs', () => {
    const climbing = file([
      { ...level, stairs: [stair('stair', 'ground', 'first')] },
      { ...level, id: 'first', name: 'First', elevationMm: 2500 },
    ]);
    expect(issues(climbing)).toEqual([]);
  });

  it('refuses the same identifier declared twice', () => {
    const twice = file([
      { ...level, walls: [wall('wall', 'ground'), wall('wall', 'ground')] },
    ]);
    expect(issues(twice)).toContain(
      '/project/building/levels/ground/walls/wall uses the identifier wall for more than one object: WALL, WALL',
    );
  });

  it('refuses one identifier used by two different objects', () => {
    // Selection, dimensions and scenario paths all address an object by its
    // identifier alone, so a collision would make a click ambiguous.
    const collision = file([{ ...level, walls: [wall('ground', 'ground')] }]);
    expect(issues(collision)).toContain(
      '/project/building/levels/ground uses the identifier ground for more than one object: LEVEL, WALL',
    );
  });

  it('refuses a collision between the families added most recently', () => {
    // The list of identified families was written by hand and had fallen seven
    // families behind the model: a stair and a saved view could share an
    // identifier and nothing said so.
    const clashing = file(
      [
        { ...level, stairs: [stair('shared', 'ground', 'first')] },
        { ...level, id: 'first', name: 'First', elevationMm: 2500 },
      ],
      {
        drawingViews: [
          {
            id: 'shared',
            type: 'PLAN',
            name: 'Vue',
            scaleDenominator: 50,
            layers: {},
            graphicProfileId: 'generic-technical-screen',
          },
        ],
      },
    );
    expect(issues(clashing).join(' ')).toContain(
      'uses the identifier shared for more than one object: STAIR, DRAWING_VIEW',
    );
  });

  it('refuses a network node placed in a space the project does not hold', () => {
    const dangling = file([level], {
      systems: [
        {
          id: 'water',
          discipline: 'WATER',
          systemType: 'POTABLE_COLD',
          nodes: [
            {
              id: 'water:sink',
              kind: 'FIXTURE',
              position: { x: 0, y: 0, z: 0 },
              spaceId: 'kitchen',
            },
          ],
          ports: [],
          edges: [],
        },
      ],
    });
    expect(issues(dangling)).toEqual([
      '/project/systems/0/nodes/0/spaceId references unknown space kitchen',
    ]);
  });

  it('refuses a network node bound to equipment the project does not hold', () => {
    const dangling = file([level], {
      systems: [
        {
          id: 'heating',
          discipline: 'HEATING',
          systemType: 'RADIATOR_LOOP',
          nodes: [
            {
              id: 'heating:boiler',
              kind: 'GENERATOR',
              position: { x: 0, y: 0, z: 0 },
              equipmentId: 'boiler-1',
            },
          ],
          ports: [],
          edges: [],
        },
      ],
    });
    expect(issues(dangling)).toEqual([
      '/project/systems/0/nodes/0/equipmentId references unknown equipment boiler-1',
    ]);
  });
});

describe('references the rest of the project relies on', () => {
  const dimension = (wallId: string) => ({
    id: 'cote',
    kind: 'DIMENSION',
    type: 'ALIGNED',
    first: { kind: 'WALL_ENDPOINT', wallId, endpoint: 'START' },
    second: { kind: 'WALL_ENDPOINT', wallId, endpoint: 'END' },
    offsetMm: 500,
  });

  it('refuses a dimension measuring a wall that does not exist', () => {
    const dangling = file([
      {
        ...level,
        walls: [wall('wall-ground', 'ground')],
        annotations: [dimension('wall-gone')],
      },
    ]);
    expect(issues(dangling)).toContain(
      '/project/building/levels/0/annotations/0/first/wallId references unknown wall wall-gone',
    );
  });

  it('refuses a dimension measuring a wall of another level', () => {
    const crossLevel = file([
      { ...level, walls: [wall('wall-ground', 'ground')] },
      {
        ...level,
        id: 'first',
        name: 'First',
        elevationMm: 2500,
        annotations: [dimension('wall-ground')],
      },
    ]);
    expect(
      issues(crossLevel).some((entry) => entry.includes('of another level')),
    ).toBe(true);
  });

  it('refuses a zone naming a room the project does not hold', () => {
    const zoned = {
      ...file([level]),
      project: {
        ...file([level]).project,
        building: {
          ...file([level]).project.building,
          zones: [
            {
              id: 'zone-thermique',
              type: 'THERMAL',
              name: 'Volume chauffé',
              spaceIds: ['space-gone'],
              properties: {},
            },
          ],
        },
      },
    };
    expect(issues(zoned)).toContain(
      '/project/building/zones/0/spaceIds/0 references unknown space space-gone',
    );
  });

  it('refuses a network node fixed to an object that does not exist', () => {
    const dangling = file([level], {
      systems: [
        {
          id: 'water',
          discipline: 'WATER',
          systemType: 'POTABLE_COLD',
          nodes: [
            {
              id: 'water:source',
              kind: 'SOURCE',
              position: { x: 0, y: 0, z: 0 },
              hostObjectId: 'wall-gone',
            },
          ],
          ports: [],
          edges: [],
        },
      ],
    });
    expect(issues(dangling)).toContain(
      '/project/systems/0/nodes/0/hostObjectId references unknown object wall-gone',
    );
  });

  it('refuses a network node placed on a level that does not exist', () => {
    const dangling = file([level], {
      systems: [
        {
          id: 'water',
          discipline: 'WATER',
          systemType: 'POTABLE_COLD',
          nodes: [
            {
              id: 'water:source',
              kind: 'SOURCE',
              position: { x: 0, y: 0, z: 0 },
              levelId: 'attic',
            },
          ],
          ports: [],
          edges: [],
        },
      ],
    });
    expect(issues(dangling)).toContain(
      '/project/systems/0/nodes/0/levelId references unknown level attic',
    );
  });

  it('refuses a node whose room and whose level are not the same level', () => {
    // Every identifier exists; together they describe a place that does not.
    const stacked = file(
      [
        { ...level, spaces: [space('living-ground', 'ground')] },
        {
          ...level,
          id: 'first',
          name: 'First',
          elevationMm: 2500,
          spaces: [space('bedroom-first', 'first')],
        },
      ],
      {
        systems: [
          {
            id: 'water',
            discipline: 'WATER',
            systemType: 'POTABLE_COLD',
            nodes: [
              {
                id: 'water:source',
                kind: 'SOURCE',
                position: { x: 0, y: 0, z: 0 },
                levelId: 'ground',
                spaceId: 'bedroom-first',
              },
            ],
            ports: [],
            edges: [],
          },
        ],
      },
    );
    expect(issues(stacked)).toContain(
      '/project/systems/0/nodes/0/spaceId references bedroom-first of level first while the node declares level ground',
    );
  });

  it('refuses a node fixed to a wall of another level than its own', () => {
    const stacked = file(
      [
        { ...level, walls: [wall('wall-ground', 'ground')] },
        {
          ...level,
          id: 'first',
          name: 'First',
          elevationMm: 2500,
          walls: [wall('wall-first', 'first')],
        },
      ],
      {
        systems: [
          {
            id: 'water',
            discipline: 'WATER',
            systemType: 'POTABLE_COLD',
            nodes: [
              {
                id: 'water:source',
                kind: 'SOURCE',
                position: { x: 0, y: 0, z: 0 },
                levelId: 'ground',
                hostObjectId: 'wall-first',
              },
            ],
            ports: [],
            edges: [],
          },
        ],
      },
    );
    expect(issues(stacked)).toContain(
      '/project/systems/0/nodes/0/hostObjectId references wall-first of level first while the node declares level ground',
    );
  });

  it('refuses a room and a host that disagree, even with no level declared', () => {
    const stacked = file(
      [
        { ...level, spaces: [space('living-ground', 'ground')] },
        {
          ...level,
          id: 'first',
          name: 'First',
          elevationMm: 2500,
          walls: [wall('wall-first', 'first')],
        },
      ],
      {
        systems: [
          {
            id: 'water',
            discipline: 'WATER',
            systemType: 'POTABLE_COLD',
            nodes: [
              {
                id: 'water:source',
                kind: 'SOURCE',
                position: { x: 0, y: 0, z: 0 },
                spaceId: 'living-ground',
                hostObjectId: 'wall-first',
              },
            ],
            ports: [],
            edges: [],
          },
        ],
      },
    );
    expect(issues(stacked)).toContain(
      '/project/systems/0/nodes/0/hostObjectId references wall-first of level first while the node sits in a space of level ground',
    );
  });

  it('says nothing about a node hosted by an equipment, which has no level', () => {
    const hosted = file([{ ...level, spaces: [space('living', 'ground')] }], {
      equipment: [
        {
          id: 'boiler',
          kind: 'BOILER',
          catalogKind: 'GENERIC',
          properties: {},
        },
      ],
      systems: [
        {
          id: 'water',
          discipline: 'WATER',
          systemType: 'POTABLE_COLD',
          nodes: [
            {
              id: 'water:source',
              kind: 'SOURCE',
              position: { x: 0, y: 0, z: 0 },
              levelId: 'ground',
              spaceId: 'living',
              hostObjectId: 'boiler',
            },
          ],
          ports: [],
          edges: [],
        },
      ],
    });
    expect(issues(hosted)).toEqual([]);
  });

  it('accepts a node whose level, room and host agree', () => {
    const coherent = file(
      [
        {
          ...level,
          walls: [wall('wall-ground', 'ground')],
          spaces: [space('living-ground', 'ground')],
        },
      ],
      {
        systems: [
          {
            id: 'water',
            discipline: 'WATER',
            systemType: 'POTABLE_COLD',
            nodes: [
              {
                id: 'water:source',
                kind: 'SOURCE',
                position: { x: 0, y: 0, z: 0 },
                levelId: 'ground',
                spaceId: 'living-ground',
                hostObjectId: 'wall-ground',
              },
            ],
            ports: [],
            edges: [],
          },
        ],
      },
    );
    expect(issues(coherent)).toEqual([]);
  });

  it('accepts a node fixed to a wall that is there', () => {
    const fine = file([{ ...level, walls: [wall('wall-ground', 'ground')] }], {
      systems: [
        {
          id: 'water',
          discipline: 'WATER',
          systemType: 'POTABLE_COLD',
          nodes: [
            {
              id: 'water:source',
              kind: 'SOURCE',
              position: { x: 0, y: 0, z: 0 },
              hostObjectId: 'wall-ground',
              levelId: 'ground',
            },
          ],
          ports: [],
          edges: [],
        },
      ],
    });
    expect(issues(fine)).toEqual([]);
  });
});

function component(id: string, extra: object = {}): Record<string, unknown> {
  return {
    id,
    type: 'COMPONENT_INSTANCE',
    levelId: 'ground',
    category: 'HEATING',
    position: { x: 1000, y: 1000 },
    elevationMm: 150,
    rotationDeg: 0,
    ...extra,
  };
}

describe('the things placed in the building', () => {
  it('accepts a level that says nothing about components', () => {
    // Every file written before components existed says nothing about them,
    // and holds none, which is the truth.
    expect(issues(file([level]))).toEqual([]);
  });

  it('accepts a component standing where the project can place it', () => {
    const fine = file([
      {
        ...level,
        walls: [wall('wall-ground', 'ground')],
        spaces: [space('space-living', 'ground')],
        components: [
          component('component-radiator', {
            spaceId: 'space-living',
            hostObjectId: 'wall-ground',
          }),
        ],
      },
    ]);
    expect(issues(fine)).toEqual([]);
    expect(() => serializeProjectFile(fine)).not.toThrow();
  });

  it('refuses a component naming a catalogue model the project has not', () => {
    expect(
      issues(
        file([
          {
            ...level,
            components: [component('c', { definitionId: 'nowhere' })],
          },
        ]),
      ),
    ).toEqual([
      '/project/building/levels/0/components/0/definitionId references unknown equipment nowhere',
    ]);
  });

  it('refuses a component naming a room the project has not', () => {
    expect(
      issues(
        file([
          { ...level, components: [component('c', { spaceId: 'nowhere' })] },
        ]),
      ),
    ).toEqual([
      '/project/building/levels/0/components/0/spaceId references unknown space nowhere',
    ]);
  });

  it('refuses a component hung on nothing', () => {
    expect(
      issues(
        file([
          {
            ...level,
            components: [component('c', { hostObjectId: 'nowhere' })],
          },
        ]),
      ),
    ).toEqual([
      '/project/building/levels/0/components/0/hostObjectId references nowhere, which is not a wall, a slab or a roof',
    ]);
  });

  it('refuses a component hung on something that is not a support', () => {
    // A room is a volume, not a surface a thing can be hung on; a catalogue
    // entry is a description, not a place.
    expect(
      issues(
        file([
          {
            ...level,
            spaces: [space('space-living', 'ground')],
            components: [component('c', { hostObjectId: 'space-living' })],
          },
        ]),
      ),
    ).toEqual([
      '/project/building/levels/0/components/0/hostObjectId references space-living, which is not a wall, a slab or a roof',
    ]);
  });

  it('refuses a component whose room is on another storey', () => {
    // Three real identifiers can still describe a place that does not exist.
    expect(
      issues(
        file([
          { ...level, components: [component('c', { spaceId: 'space-up' })] },
          {
            ...level,
            id: 'first',
            name: 'First',
            elevationMm: 2500,
            spaces: [space('space-up', 'first')],
          },
        ]),
      ),
    ).toEqual([
      '/project/building/levels/0/components/0/spaceId references space-up of level first while the component declares level ground',
    ]);
  });

  it('refuses a component fixed to a wall of another storey', () => {
    expect(
      issues(
        file([
          {
            ...level,
            components: [component('c', { hostObjectId: 'wall-first' })],
          },
          {
            ...level,
            id: 'first',
            name: 'First',
            elevationMm: 2500,
            walls: [wall('wall-first', 'first')],
          },
        ]),
      ),
    ).toEqual([
      '/project/building/levels/0/components/0/hostObjectId references wall-first of level first while the component declares level ground',
    ]);
  });

  it('refuses a component kept on one level and declaring another', () => {
    expect(
      issues(
        file([
          { ...level, components: [component('c', { levelId: 'first' })] },
          { ...level, id: 'first', name: 'First', elevationMm: 2500 },
        ]),
      ),
    ).toEqual([
      '/project/building/levels/0/components/0/levelId is stored on level ground but declares level first',
    ]);
  });

  it('accepts a component fixed to a wall of its own storey', () => {
    expect(
      issues(
        file([
          {
            ...level,
            walls: [wall('wall-ground', 'ground')],
            spaces: [space('space-living', 'ground')],
            components: [
              component('c', {
                hostObjectId: 'wall-ground',
                spaceId: 'space-living',
              }),
            ],
          },
        ]),
      ),
    ).toEqual([]);
  });

  it('lets a network node stand for a component that is placed', () => {
    const fine = file(
      [{ ...level, components: [component('component-boiler')] }],
      {
        systems: [
          {
            id: 'water',
            discipline: 'WATER',
            systemType: 'POTABLE_COLD',
            nodes: [
              {
                id: 'water:source',
                kind: 'SOURCE',
                position: { x: 0, y: 0, z: 0 },
                hostObjectId: 'component-boiler',
                levelId: 'ground',
              },
            ],
            ports: [],
            edges: [],
          },
        ],
      },
    );
    expect(issues(fine)).toEqual([]);
  });
});
