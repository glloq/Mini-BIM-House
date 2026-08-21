import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import { entityId } from '@house-technical-designer/core-domain';
import type { ScenePrimitive } from '@house-technical-designer/drawing-engine';
import { buildPlanView, previewWallFaces } from './plan-view.js';
import {
  LAYER_PRESETS,
  PLAN_LAYERS,
  defaultVisibility,
  presetVisibility,
  visibleDisciplines,
} from './layers.js';

const levelId = entityId<'Level'>('ground');

function project(): Project {
  return {
    id: entityId<'Project'>('view-fixture'),
    metadata: {
      name: 'View fixture',
      createdAt: '2026-08-19T00:00:00Z',
      updatedAt: '2026-08-19T00:00:00Z',
    },
    site: { northAngleDeg: 0 },
    materialLibrary: {
      materials: [
        {
          id: 'masonry' as never,
          name: 'Maçonnerie',
          kind: 'GENERIC',
          properties: { lambdaWmK: 0.8 },
        },
        {
          id: 'insulation' as never,
          name: 'Isolant',
          kind: 'GENERIC',
          properties: { lambdaWmK: 0.035 },
        },
      ],
    },
    assemblies: [
      {
        id: 'wall-assembly' as never,
        name: 'Mur',
        category: 'WALL',
        layers: [
          {
            id: 'masonry-layer' as never,
            materialId: 'masonry' as never,
            thicknessM: 0.2,
            role: 'STRUCTURAL',
          },
          {
            id: 'insulation-layer' as never,
            materialId: 'insulation' as never,
            thicknessM: 0.1,
            role: 'INSULATION',
          },
        ],
      },
    ],
    building: {
      levels: [
        {
          id: levelId,
          name: 'RDC',
          elevationMm: 0,
          defaultStoreyHeightMm: 2500,
          walls: [
            {
              id: entityId<'Wall'>('wall-south'),
              type: 'WALL',
              levelId,
              path: {
                points: [
                  { x: 0, y: 0 },
                  { x: 6000, y: 0 },
                ],
              },
              referenceSide: 'CENTER',
              assemblyId: 'wall-assembly' as never,
              baseOffsetMm: 0,
              heightMode: 'EXPLICIT',
              heightMm: 2500,
              role: 'EXTERIOR',
            },
            {
              id: entityId<'Wall'>('wall-west'),
              type: 'WALL',
              levelId,
              path: {
                points: [
                  { x: 0, y: 0 },
                  { x: 0, y: 4000 },
                ],
              },
              referenceSide: 'CENTER',
              assemblyId: 'wall-assembly' as never,
              baseOffsetMm: 0,
              heightMode: 'EXPLICIT',
              heightMm: 2500,
              role: 'EXTERIOR',
            },
          ],
          openings: [
            {
              id: entityId<'Opening'>('entry-door'),
              type: 'OPENING',
              openingType: 'DOOR',
              hostElementId: entityId<'Wall'>('wall-south'),
              offsetAlongHostMm: 1000,
              sillHeightMm: 0,
              widthMm: 900,
              heightMm: 2100,
            },
            {
              id: entityId<'Opening'>('living-window'),
              type: 'OPENING',
              openingType: 'WINDOW',
              hostElementId: entityId<'Wall'>('wall-west'),
              offsetAlongHostMm: 1000,
              sillHeightMm: 900,
              widthMm: 1200,
              heightMm: 1200,
            },
          ],
          slabs: [
            {
              id: entityId<'Slab'>('slab'),
              type: 'SLAB',
              levelId,
              polygon: {
                outer: [
                  { x: 0, y: 0 },
                  { x: 6000, y: 0 },
                  { x: 6000, y: 4000 },
                  { x: 0, y: 4000 },
                ],
              },
              assemblyId: 'wall-assembly' as never,
              elevationOffsetMm: 0,
              role: 'FLOOR',
            },
          ],
          roofs: [],
          spaces: [
            {
              id: entityId<'Space'>('living'),
              type: 'SPACE',
              levelId,
              name: 'Séjour',
              category: 'LIVING',
              boundaryMode: 'MANUAL',
              manualPolygon: {
                outer: [
                  { x: 0, y: 0 },
                  { x: 6000, y: 0 },
                  { x: 6000, y: 4000 },
                  { x: 0, y: 4000 },
                ],
              },
            },
          ],
          stairs: [],
          annotations: [],
        },
      ],
      zones: [],
    },
    systems: [
      {
        id: 'water',
        discipline: 'WATER',
        systemType: 'POTABLE_COLD',
        nodes: [
          { id: 'source', kind: 'SOURCE', position: { x: 0, y: 0, z: 400 } },
          {
            id: 'sink',
            kind: 'FIXTURE',
            position: { x: 5000, y: 3000, z: 400 },
          },
        ],
        ports: [
          { id: 'out', nodeId: 'source', role: 'FLOW', direction: 'OUT' },
          { id: 'in', nodeId: 'sink', role: 'FLOW', direction: 'IN' },
        ],
        edges: [
          {
            id: 'pipe',
            fromPortId: 'out',
            toPortId: 'in',
            path: [
              { x: 0, y: 0, z: 400 },
              { x: 5000, y: 3000, z: 400 },
            ],
            kind: 'PIPE',
          },
        ],
      },
    ],
  };
}

function find(
  primitives: readonly ScenePrimitive[],
  id: string,
): ScenePrimitive | undefined {
  return primitives.find((primitive) => primitive.id === id);
}

describe('plan view walls', () => {
  it('draws walls with their real thickness rather than their axis', () => {
    const { primitives } = buildPlanView(project());
    const wall = find(primitives, 'wall:wall-south')!;
    expect(wall.geometry.kind).toBe('POLYGON');
    expect(wall.metadata?.thicknessMm).toBeCloseTo(300, 6);
    if (wall.geometry.kind !== 'POLYGON') return;
    // A 6 m wall 300 mm thick covers 1.8 m².
    const points = wall.geometry.polygon.outer;
    const ys = points.map(({ y }) => y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(300, 6);
  });

  it('draws one band per assembly layer, carrying its material and role', () => {
    const { primitives } = buildPlanView(project());
    const bands = primitives.filter(
      ({ layer }) => layer === 'architecture.wall-layers',
    );
    expect(bands).toHaveLength(4);
    const masonry = find(primitives, 'wall-layer:wall-south:masonry-layer')!;
    expect(masonry.metadata).toMatchObject({
      materialId: 'masonry',
      layerRole: 'STRUCTURAL',
    });
    expect(masonry.metadata?.thicknessMm).toBeCloseTo(200, 6);
    const insulation = find(
      primitives,
      'wall-layer:wall-south:insulation-layer',
    )!;
    expect(insulation.metadata?.thicknessMm).toBeCloseTo(100, 6);
    // The bands are stacked, not superimposed on the same offset.
    if (
      masonry.geometry.kind !== 'POLYGON' ||
      insulation.geometry.kind !== 'POLYGON'
    )
      return;
    const masonryYs = masonry.geometry.polygon.outer.map(({ y }) => y);
    const insulationYs = insulation.geometry.polygon.outer.map(({ y }) => y);
    expect(Math.min(...masonryYs)).toBeCloseTo(Math.max(...insulationYs), 6);
  });

  it('reports the join between two walls that meet', () => {
    const { primitives } = buildPlanView(project());
    const join = find(primitives, 'wall-join:wall-south:wall-west');
    expect(join?.metadata?.joinKind).toBe('L');
    expect(join?.geometry).toEqual({ kind: 'POINT', point: { x: 0, y: 0 } });
  });

  it('reports a wall whose assembly is missing instead of drawing it', () => {
    const broken = project();
    const result = buildPlanView({
      ...broken,
      assemblies: [],
    });
    expect(result.issues.map(({ code }) => code)).toContain(
      'VIEW_MISSING_ASSEMBLY',
    );
    expect(find(result.primitives, 'wall:wall-south')).toBeUndefined();
  });
});

describe('plan view openings', () => {
  it('cuts a reveal through the host wall for every opening', () => {
    const { primitives } = buildPlanView(project());
    const door = find(primitives, 'opening:entry-door')!;
    expect(door.semanticRole).toBe('OPENING_REVEAL');
    expect(door.metadata).toMatchObject({
      openingType: 'DOOR',
      widthMm: 900,
      hostElementId: 'wall-south',
    });
    if (door.geometry.kind !== 'POLYGON') return;
    const xs = door.geometry.polygon.outer.map(({ x }) => x);
    expect(Math.min(...xs)).toBeCloseTo(1000, 6);
    expect(Math.max(...xs)).toBeCloseTo(1900, 6);
  });

  it('draws a leaf and a swing arc for a door', () => {
    const { primitives } = buildPlanView(project());
    const leaf = find(primitives, 'opening-leaf:entry-door')!;
    const swing = find(primitives, 'opening-swing:entry-door')!;
    expect(leaf.geometry.kind).toBe('POLYLINE');
    expect(swing.geometry.kind).toBe('POLYLINE');
    if (swing.geometry.kind !== 'POLYLINE') return;
    // The arc keeps a constant radius equal to the leaf width.
    const hinge = swing.geometry.polyline.points[0]!;
    const centre = { x: 1000, y: -150 };
    for (const point of swing.geometry.polyline.points)
      expect(Math.hypot(point.x - centre.x, point.y - centre.y)).toBeCloseTo(
        900,
        6,
      );
    expect(hinge).toBeDefined();
  });

  it('draws a glazing line and keeps the sill height for a window', () => {
    const { primitives } = buildPlanView(project());
    const glazing = find(primitives, 'opening-glazing:living-window')!;
    expect(glazing.metadata).toMatchObject({
      part: 'GLAZING',
      sillHeightMm: 900,
    });
    expect(glazing.geometry.kind).toBe('POLYLINE');
  });

  it('reports an opening that runs past the end of its wall', () => {
    const base = project();
    const level = base.building.levels[0]!;
    const result = buildPlanView({
      ...base,
      building: {
        ...base.building,
        levels: [
          {
            ...level,
            openings: level.openings.map((opening) =>
              opening.id === 'entry-door'
                ? { ...opening, offsetAlongHostMm: 5800 }
                : opening,
            ),
          },
        ],
      },
    });
    expect(result.issues.map(({ code }) => code)).toContain(
      'VIEW_OPENING_OUTSIDE_HOST',
    );
  });

  it('reports an opening whose host wall is not on the level', () => {
    const base = project();
    const level = base.building.levels[0]!;
    const result = buildPlanView({
      ...base,
      building: {
        ...base.building,
        levels: [
          {
            ...level,
            openings: level.openings.map((opening) => ({
              ...opening,
              hostElementId: entityId<'Wall'>('nowhere'),
            })),
          },
        ],
      },
    });
    expect(result.issues.map(({ code }) => code)).toContain(
      'VIEW_UNRESOLVED_HOST',
    );
  });
});

describe('plan view spaces and networks', () => {
  it('fills and labels a space with its derived area and volume', () => {
    const { primitives } = buildPlanView(project());
    const fill = find(primitives, 'space:living')!;
    expect(fill.metadata).toMatchObject({
      name: 'Séjour',
      areaM2: 24,
      volumeM3: 60,
      heightM: 2.5,
    });
    const label = find(primitives, 'space-label:living')!;
    expect(label.geometry.kind).toBe('TEXT');
    if (label.geometry.kind === 'TEXT')
      expect(label.geometry.text).toContain('Séjour');
  });

  it('routes each network onto its discipline layer', () => {
    const { primitives } = buildPlanView(project(), {
      layers: { ...defaultVisibility(), 'water.pipes': true },
    });
    const pipe = find(primitives, 'network-edge:water:pipe')!;
    expect(pipe.discipline).toBe('WATER');
    expect(pipe.semanticRole).toBe('WATER_COLD');
    expect(pipe.layer).toBe('water.pipes');
    expect(find(primitives, 'network-node:water:sink')?.geometry.kind).toBe(
      'POINT',
    );
  });
});

describe('plan view layers and state', () => {
  it('hides the primitives of a layer that is switched off', () => {
    const hidden = buildPlanView(project(), {
      layers: { ...defaultVisibility(), 'architecture.wall-layers': false },
    });
    expect(
      hidden.primitives.some(
        ({ layer }) => layer === 'architecture.wall-layers',
      ),
    ).toBe(false);
    expect(find(hidden.primitives, 'wall:wall-south')).toBeDefined();
  });

  it('marks the selected and hovered objects without touching the project', () => {
    const source = project();
    const { primitives } = buildPlanView(source, {
      selection: ['wall-south'],
      hoveredId: 'living',
    });
    expect(find(primitives, 'wall:wall-south')?.state).toBe('SELECTED');
    expect(find(primitives, 'space:living')?.state).toBe('HOVER');
    expect(source.building.levels[0]!.walls[0]).not.toHaveProperty('state');
  });

  it('derives the viewport from what is drawn', () => {
    const { view } = buildPlanView(project(), { paddingMm: 500 });
    expect(view.viewport.min.x).toBeCloseTo(-650, 6);
    expect(view.viewport.max.x).toBeCloseTo(6500, 6);
    expect(view.type).toBe('PLAN');
    expect(view.levelId).toBe('ground');
  });

  it('reports an unknown level rather than drawing another one', () => {
    const result = buildPlanView(project(), { levelId: 'first-floor' });
    expect(result.issues.map(({ code }) => code)).toEqual([
      'VIEW_UNKNOWN_LEVEL',
    ]);
    expect(result.primitives).toEqual([]);
  });
});

describe('layer presets', () => {
  it('turns on exactly the layers a discipline view needs', () => {
    const plumbing = LAYER_PRESETS.find(({ id }) => id === 'plumbing')!;
    const visibility = presetVisibility(plumbing);
    expect(visibility['water.pipes']).toBe(true);
    expect(visibility['electrical.circuits']).toBe(false);
    expect(visibleDisciplines(visibility)).toEqual(
      expect.arrayContaining(['ARCHITECTURE', 'WATER', 'WASTEWATER']),
    );
  });

  it('only references layers the plan actually defines', () => {
    const known = new Set(PLAN_LAYERS.map(({ id }) => id));
    for (const preset of LAYER_PRESETS)
      for (const layer of preset.layers) expect(known.has(layer)).toBe(true);
  });
});

describe('wall preview', () => {
  it('offsets a drafted path into a footprint before the wall exists', () => {
    const polygon = previewWallFaces(
      [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
      ],
      300,
    )!;
    const ys = polygon.outer.map(({ y }) => y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(300, 6);
  });

  it('returns nothing for a degenerate path', () => {
    expect(
      previewWallFaces(
        [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
        300,
      ),
    ).toBeUndefined();
  });
});

/** The fixture with a post, a plot and three placed things on it. */
function withEverything(): Project {
  const base = project();
  const ground = base.building.levels[0]!;
  const placed = (
    id: string,
    category: 'HEATING' | 'SANITARY' | 'FURNITURE',
    x: number,
  ) => ({
    id: entityId<'ComponentInstance'>(id),
    type: 'COMPONENT_INSTANCE' as const,
    levelId,
    category,
    position: { x, y: 1000 },
    elevationMm: 300,
    rotationDeg: 0,
  });
  return {
    ...base,
    site: {
      ...base.site,
      parcelBoundary: {
        outer: [
          { x: -2000, y: -2000 },
          { x: 9000, y: -2000 },
          { x: 9000, y: 7000 },
          { x: -2000, y: 7000 },
        ],
      },
    },
    building: {
      ...base.building,
      levels: [
        {
          ...ground,
          structure: [
            {
              id: entityId<'StructuralMember'>('member-column'),
              type: 'STRUCTURAL_MEMBER',
              levelId,
              kind: 'COLUMN',
              path: [{ x: 2000, y: 2000 }],
              widthMm: 200,
              depthMm: 200,
            },
          ],
          components: [
            placed('component-radiator', 'HEATING', 1000),
            placed('component-sink', 'SANITARY', 2000),
            placed('component-sofa', 'FURNITURE', 3000),
          ],
        },
      ],
    },
  };
}

describe('what discipline a drawing reads each thing by', () => {
  it('separates the frame, the ground and the trades', () => {
    // A post, a parcel and a radiator were « architecture » and « other »: an
    // exported drawing could not tell the frame from the masonry, nor the plot
    // from the furniture.
    const project = withEverything();
    const view = buildPlanView(project, {
      levelId: 'ground',
      layers: defaultVisibility(),
    });
    const disciplineOf = (id: string) =>
      view.primitives.find((primitive) => primitive.id === id)?.discipline;
    expect(disciplineOf('structure:member-column')).toBe('STRUCTURE');
    expect(disciplineOf('site:parcel')).toBe('SITE');
    expect(disciplineOf('component:component-radiator')).toBe('HEATING');
    expect(disciplineOf('component:component-sink')).toBe('WATER');
    expect(disciplineOf('component:component-sofa')).toBe('OTHER');
  });

  it('keeps every one of them visible under its own layer', () => {
    // A discipline the visible layers do not carry is filtered out of the
    // scene: giving the post its own discipline had to give the layer it is
    // drawn on the same one, or the post would have vanished.
    const view = buildPlanView(withEverything(), {
      levelId: 'ground',
      layers: defaultVisibility(),
    });
    for (const id of [
      'structure:member-column',
      'site:parcel',
      'component:component-radiator',
      'component:component-sink',
    ])
      expect(
        view.primitives.some((primitive) => primitive.id === id),
        id,
      ).toBe(true);
  });
});
