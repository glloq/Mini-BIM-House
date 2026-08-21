import { describe, expect, it } from 'vitest';
import type { Project } from './types.js';
import { entityId } from './ids.js';
import {
  ENTITY_FAMILIES,
  SCENARIO_DIFFABLE,
  entityCollisions,
  entityIndex,
  localCollisions,
  projectEntities,
} from './entity-index.js';

/**
 * A project holding one object of every family the model knows.
 *
 * The fixture is the point of this suite: it is what a crawler walks to prove
 * that nothing carrying an identifier escapes the index.
 */
export function populated(): Project {
  const levelId = entityId<'Level'>('ground');
  const upperId = entityId<'Level'>('upper');
  const assemblyId = 'assembly-wall' as never;
  const materialId = 'material' as never;
  const level = {
    id: levelId,
    name: 'Rez-de-chaussée',
    elevationMm: 0,
    defaultStoreyHeightMm: 2500,
    walls: [
      {
        id: entityId<'Wall'>('wall-south'),
        type: 'WALL' as const,
        levelId,
        path: {
          points: [
            { x: 0, y: 0 },
            { x: 6000, y: 0 },
          ],
        },
        referenceSide: 'CENTER' as const,
        assemblyId,
        baseOffsetMm: 0,
        heightMode: 'EXPLICIT' as const,
        heightMm: 2500,
        role: 'EXTERIOR' as const,
      },
    ],
    openings: [
      {
        id: entityId<'Opening'>('opening-entry'),
        type: 'OPENING' as const,
        openingType: 'DOOR' as const,
        hostElementId: entityId<'Wall'>('wall-south'),
        offsetAlongHostMm: 1000,
        sillHeightMm: 0,
        widthMm: 900,
        heightMm: 2100,
      },
    ],
    slabs: [
      {
        id: entityId<'Slab'>('slab-ground'),
        type: 'SLAB' as const,
        levelId,
        polygon: {
          outer: [
            { x: 0, y: 0 },
            { x: 6000, y: 0 },
            { x: 6000, y: 4000 },
            { x: 0, y: 4000 },
          ],
        },
        assemblyId,
        role: 'FLOOR' as const,
        elevationOffsetMm: 0,
      },
    ],
    roofs: [
      {
        id: entityId<'RoofPlane'>('roof-plane'),
        type: 'ROOF_PLANE' as const,
        levelId,
        footprint: {
          outer: [
            { x: 0, y: 0 },
            { x: 6000, y: 0 },
            { x: 6000, y: 4000 },
          ],
        },
        assemblyId,
        slopeDeg: 30,
        azimuthDeg: 180,
        baseElevationMm: 2500,
      },
    ],
    roofStructures: [
      {
        id: entityId<'Roof'>('roof-whole'),
        type: 'ROOF' as const,
        levelId,
        footprint: {
          outer: [
            { x: 0, y: 0 },
            { x: 6000, y: 0 },
            { x: 6000, y: 4000 },
            { x: 0, y: 4000 },
          ],
        },
        edges: Array.from({ length: 4 }, () => ({
          kind: 'SLOPED' as const,
          slopeDeg: 35,
          overhangMm: 400,
        })),
        assemblyId,
        baseElevationMm: 2500,
      },
    ],
    stairs: [
      {
        id: entityId<'Stair'>('stair-main'),
        type: 'STAIR' as const,
        levelId,
        topLevelId: upperId,
        stairType: 'STRAIGHT' as const,
        widthMm: 900,
        riserCount: 16,
        treadDepthMm: 270,
        path: {
          points: [
            { x: 0, y: 0 },
            { x: 4050, y: 0 },
          ],
        },
      },
    ],
    spaces: [
      {
        id: entityId<'Space'>('space-living'),
        type: 'SPACE' as const,
        levelId,
        name: 'Séjour',
        category: 'LIVING',
        boundaryMode: 'MANUAL' as const,
        manualPolygon: {
          outer: [
            { x: 0, y: 0 },
            { x: 3000, y: 0 },
            { x: 3000, y: 3000 },
          ],
        },
      },
    ],
    annotations: [
      {
        id: 'note-1' as never,
        kind: 'TEXT' as const,
        at: { x: 100, y: 100 },
        text: 'Existant à démolir',
      },
    ],
    structure: [
      {
        id: entityId<'StructuralMember'>('member-column'),
        type: 'STRUCTURAL_MEMBER' as const,
        levelId,
        kind: 'COLUMN' as const,
        path: [{ x: 2000, y: 2000 }],
        widthMm: 200,
        depthMm: 200,
      },
    ],
    components: [
      {
        id: entityId<'ComponentInstance'>('component-radiator'),
        type: 'COMPONENT_INSTANCE' as const,
        levelId,
        category: 'HEATING' as const,
        name: 'Radiateur séjour',
        position: { x: 3000, y: 1000 },
        elevationMm: 300,
        rotationDeg: 0,
      },
    ],
  };
  return {
    id: entityId<'Project'>('project'),
    metadata: {
      name: 'Projet',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    site: {
      northAngleDeg: 0,
      parcelBoundary: {
        outer: [
          { x: -5000, y: -5000 },
          { x: 20_000, y: -5000 },
          { x: 20_000, y: 18_000 },
        ],
      },
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
          name: 'Tilleul',
        },
      ],
    },
    building: {
      levels: [
        level,
        {
          ...level,
          id: upperId,
          name: 'Étage',
          elevationMm: 2700,
          walls: [],
          openings: [],
          slabs: [],
          roofs: [],
          roofStructures: [],
          stairs: [],
          spaces: [],
          annotations: [],
          structure: [],
          components: [],
        },
      ],
      zones: [
        {
          id: entityId('zone-thermal'),
          type: 'THERMAL' as const,
          name: 'Volume chauffé',
          spaceIds: [entityId<'Space'>('space-living')],
          properties: {},
        },
      ],
    },
    materialLibrary: {
      materials: [
        {
          id: materialId,
          name: 'Maçonnerie',
          kind: 'GENERIC' as const,
          properties: { lambdaWmK: 0.8 },
        },
      ],
    },
    assemblies: [
      {
        id: assemblyId,
        name: 'Mur',
        category: 'WALL' as const,
        layers: [{ id: 'layer-masonry' as never, materialId, thicknessM: 0.2 }],
      },
    ],
    equipment: [
      {
        id: entityId('equipment-pump'),
        kind: 'PUMP',
        catalogKind: 'GENERIC' as const,
        properties: {},
      },
    ],
    systems: [
      {
        id: entityId('water'),
        discipline: 'WATER' as const,
        systemType: 'POTABLE_COLD',
        nodes: [
          {
            id: entityId('water:sink'),
            kind: 'FIXTURE',
            position: { x: 0, y: 0, z: 0 },
          },
        ],
        ports: [
          {
            id: entityId('water:sink:out'),
            nodeId: entityId('water:sink'),
            direction: 'OUT' as const,
            role: 'POTABLE_COLD',
          },
          {
            id: entityId('water:sink:in'),
            nodeId: entityId('water:sink'),
            direction: 'IN' as const,
            role: 'POTABLE_COLD',
          },
        ],
        edges: [
          {
            id: entityId('water:trunk'),
            kind: 'PIPE',
            fromPortId: entityId('water:sink:out'),
            toPortId: entityId('water:sink:in'),
            path: [
              { x: 0, y: 0, z: 0 },
              { x: 1000, y: 0, z: 0 },
            ],
          },
        ],
      },
    ],
    scenarios: [
      {
        id: entityId('scenario-a'),
        name: 'Variante',
        baseProjectRevision: '',
        overrides: [],
      },
    ],
    drawingViews: [
      {
        id: 'view-1',
        type: 'PLAN' as const,
        name: 'Plan',
        scaleDenominator: 50,
        layers: {},
        graphicProfileId: 'generic-technical-screen',
      },
    ],
    sheets: [
      {
        id: 'sheet-1',
        number: 'A-001',
        title: 'Plans',
        format: 'A3' as const,
        orientation: 'LANDSCAPE' as const,
        viewports: [
          {
            id: 'viewport-1',
            viewId: 'view-1',
            scaleDenominator: 50,
            x: 10,
            y: 10,
            width: 200,
            height: 150,
          },
        ],
      },
    ],
  };
}

/**
 * Every object in the project that carries an identifier, found by walking it.
 *
 * The index is written by hand, and a hand-written list of families is exactly
 * what fell seven families behind the model. This finds them the other way
 * round — from the data — so a family added anywhere has to be claimed.
 */
function crawledIds(value: unknown, path: string): readonly string[] {
  if (Array.isArray(value))
    return value.flatMap((entry, index) =>
      crawledIds(entry, `${path}/${index}`),
    );
  if (typeof value !== 'object' || value === null) return [];
  const record = value as Record<string, unknown>;
  const own = typeof record.id === 'string' ? [`${path}#${record.id}`] : [];
  return [
    ...own,
    ...Object.entries(record).flatMap(([key, child]) =>
      key === 'id' ? [] : crawledIds(child, `${path}/${key}`),
    ),
  ];
}

describe('the one index of what a project holds', () => {
  const project = populated();

  it('claims every object the project gives an identifier to', () => {
    // The crawler walks the data; the index is written by hand. Anything the
    // first finds and the second does not is a family that can be drawn and
    // not found, not checked and not addressed.
    const crawled = crawledIds(project, '').map((entry) =>
      entry.slice(entry.indexOf('#') + 1),
    );
    const claimed = new Set(projectEntities(project).map(({ id }) => id));
    const unclaimed = [...new Set(crawled)].filter((id) => !claimed.has(id));
    expect(unclaimed).toEqual([]);
  });

  it('covers every family it declares', () => {
    const found = new Set(projectEntities(project).map(({ family }) => family));
    expect([...ENTITY_FAMILIES].filter((name) => !found.has(name))).toEqual([]);
  });

  it('says where each object lives and which storey it is on', () => {
    const index = entityIndex(project);
    expect(index.get('wall-south')).toMatchObject({
      family: 'WALL',
      scope: 'GLOBAL',
      path: 'building/levels/ground/walls/wall-south',
      levelId: 'ground',
    });
    expect(index.get('sheet-1')).toMatchObject({
      family: 'SHEET',
      path: 'sheets/sheet-1',
      label: 'Plans',
    });
  });

  it('finds nothing wrong with a project whose identifiers are its own', () => {
    expect(entityCollisions(project)).toEqual([]);
    expect(localCollisions(project)).toEqual([]);
  });

  it('names both families when two of them share an identifier', () => {
    const clashing = {
      ...project,
      drawingViews: [{ ...project.drawingViews![0]!, id: 'stair-main' }],
    };
    const [collision] = entityCollisions(clashing);
    expect(collision?.id).toBe('stair-main');
    expect(collision?.entities.map(({ family }) => family)).toEqual([
      'STAIR',
      'DRAWING_VIEW',
    ]);
  });

  it('lets two assemblies hold a layer of the same name', () => {
    // A layer is addressed through its assembly, so requiring more would
    // refuse files that read perfectly.
    const twoAssemblies = {
      ...project,
      assemblies: [
        project.assemblies![0]!,
        { ...project.assemblies![0]!, id: 'assembly-roof' as never },
      ],
    };
    expect(localCollisions(twoAssemblies)).toEqual([]);
    expect(entityCollisions(twoAssemblies)).toEqual([]);
  });

  it('refuses one assembly holding the same layer twice', () => {
    const assembly = project.assemblies![0]!;
    const doubled = {
      ...project,
      assemblies: [
        { ...assembly, layers: [assembly.layers[0]!, assembly.layers[0]!] },
      ],
    };
    expect(localCollisions(doubled).map(({ id }) => id)).toEqual([
      'layer-masonry',
    ]);
  });
});

describe('which families a variant is compared on', () => {
  it('has decided for every family the model knows', () => {
    // The scenario diff used to enumerate nine families by hand and had
    // already fallen behind: a variant moving a post, planting a tree or
    // adding a note showed nothing at all. Adding a family now fails here
    // until somebody has said which side it falls on.
    for (const family of ENTITY_FAMILIES)
      expect(SCENARIO_DIFFABLE[family], family).toBeTypeOf('boolean');
  });

  it('compares what somebody can see change on the plan', () => {
    for (const family of [
      'WALL',
      'OPENING',
      'SPACE',
      'STRUCTURAL_MEMBER',
      'SITE_OBSTACLE',
      'ANNOTATION',
      'COMPONENT',
      'NETWORK_EDGE',
    ] as const)
      expect(SCENARIO_DIFFABLE[family], family).toBe(true);
  });

  it('leaves alone the drawing of the change, and the variants themselves', () => {
    for (const family of [
      'DRAWING_VIEW',
      'SHEET',
      'SHEET_VIEWPORT',
      'SCENARIO',
      'PROJECT',
    ] as const)
      expect(SCENARIO_DIFFABLE[family], family).toBe(false);
  });
});
