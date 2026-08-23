import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import { entityId } from '@house-technical-designer/core-domain';
import type { ScenePrimitive } from '@house-technical-designer/drawing-engine';
import { polygonContains } from '@house-technical-designer/geometry';
import { buildPlanView, previewWallFaces } from './plan-view.js';
import {
  LAYER_PRESETS,
  PLAN_LAYERS,
  defaultVisibility,
  presetVisibility,
  visibleDisciplines,
} from './layers.js';

const levelId = entityId<'Level'>('ground');

/** The fixture's one room, given another outline. */
function withRoomOutline(
  base: Project,
  outer: readonly { readonly x: number; readonly y: number }[],
): Project {
  const level = base.building.levels[0]!;
  return {
    ...base,
    building: {
      ...base.building,
      levels: [
        {
          ...level,
          spaces: level.spaces.map((space) => ({
            ...space,
            boundaryMode: 'MANUAL' as const,
            manualPolygon: { outer: [...outer] },
          })),
        },
      ],
    },
  };
}

const withLShapedRoom = (base: Project): Project =>
  withRoomOutline(base, [
    { x: 0, y: 0 },
    { x: 6000, y: 0 },
    { x: 6000, y: 2000 },
    { x: 2000, y: 2000 },
    { x: 2000, y: 6000 },
    { x: 0, y: 6000 },
  ]);

const withClosetRoom = (base: Project): Project =>
  withRoomOutline(base, [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 400 },
    { x: 0, y: 400 },
  ]);

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

  it('keeps the make-up of a wall out of the architectural plan', () => {
    // Three bands of colour in every wall bury what the architectural drawing
    // exists to show. The build-up belongs to the materials drawing, and the
    // layer is where the two are told apart.
    const architectural = buildPlanView(project());
    expect(
      architectural.primitives.filter(
        ({ layer }) => layer === 'architecture.wall-layers',
      ),
    ).toEqual([]);
  });

  it('draws one band per assembly layer, carrying its material and role', () => {
    const { primitives } = buildPlanView(project(), {
      layers: presetVisibility(
        LAYER_PRESETS.find(({ id }) => id === 'materials')!,
      ),
    });
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
    expect(join?.geometry.kind).toBe('POLYGON');
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
    // Two primitives, not one string holding a newline: SVG draws no line
    // break, so « Séjour\n24.00 m² » came out as one run of text.
    const name = find(primitives, 'space-label-name:living')!;
    const area = find(primitives, 'space-label-area:living')!;
    expect(name.metadata).toMatchObject({ labelPart: 'NAME' });
    expect(area.metadata).toMatchObject({ labelPart: 'AREA' });
    if (name.geometry.kind !== 'TEXT' || area.geometry.kind !== 'TEXT') return;
    expect(name.geometry.text).toBe('Séjour');
    expect(area.geometry.text).toBe('24.00 m²');
    expect(name.geometry.anchor.x).toBe(area.geometry.anchor.x);
    expect(name.geometry.anchor.y).toBeLessThan(area.geometry.anchor.y);
  });

  it('places the name where the room is, not at the average of its corners', () => {
    // The average of an L's corners falls in the notch, so the room's name
    // used to land in the corridor next door.
    const ell = withLShapedRoom(project());
    const { primitives } = buildPlanView(ell);
    const name = find(primitives, 'space-label-name:living')!;
    const fill = find(primitives, 'space:living')!;
    if (name.geometry.kind !== 'TEXT' || fill.geometry.kind !== 'POLYGON')
      return;
    expect(polygonContains(fill.geometry.polygon, name.geometry.anchor)).toBe(
      true,
    );
  });

  it('writes the area only where there is room for a second line', () => {
    // A cupboard gets its name or nothing: a label spilling into the room next
    // door is worse than a room left unnamed.
    const closet = withClosetRoom(project());
    const near = buildPlanView(closet, { scale: 50 }).primitives;
    expect(find(near, 'space-label-area:living')).toBeDefined();
    // At 1:100 the same closet has half the paper: the name still fits, the
    // second line no longer does.
    const far = buildPlanView(closet, { scale: 100 }).primitives;
    expect(find(far, 'space-label-name:living')).toBeDefined();
    expect(find(far, 'space-label-area:living')).toBeUndefined();
    // At 1:200 nothing fits, and nothing is written rather than written out
    // into the room next door.
    const distant = buildPlanView(closet, { scale: 200 }).primitives;
    expect(find(distant, 'space-label-name:living')).toBeUndefined();
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

/**
 * Two walls, and the corner they make.
 *
 * Each wall is drawn as its own rectangle, so two walls meeting at their ends
 * cover three of the four quadrants around the corner and leave the fourth
 * empty: a white notch bitten out of the outside of every corner of a house.
 * These cases are the shapes a corner comes in.
 */
describe('wall junctions', () => {
  interface Leg {
    readonly id: string;
    readonly from: { readonly x: number; readonly y: number };
    readonly to: { readonly x: number; readonly y: number };
    readonly thicknessMm?: number;
    readonly role?: 'EXTERIOR' | 'INTERIOR' | 'PARTITION' | 'OTHER';
  }

  const assemblyOf = (thicknessMm: number): unknown => ({
    id: `assembly-${thicknessMm}`,
    name: `Mur ${thicknessMm}`,
    category: 'WALL',
    layers: [
      {
        id: `layer-${thicknessMm}`,
        materialId: 'masonry',
        thicknessM: thicknessMm / 1000,
        role: 'STRUCTURAL',
      },
    ],
  });

  function junction(first: Leg, second: Leg): Project {
    const base = project();
    const legs = [first, second];
    const thicknesses = [
      ...new Set(legs.map(({ thicknessMm }) => thicknessMm ?? 300)),
    ];
    const level = base.building.levels[0]!;
    return {
      ...base,
      assemblies: thicknesses.map(assemblyOf) as NonNullable<
        Project['assemblies']
      >,
      building: {
        ...base.building,
        levels: [
          {
            ...level,
            spaces: [],
            walls: legs.map(
              (leg) =>
                ({
                  id: entityId<'Wall'>(leg.id),
                  type: 'WALL',
                  levelId,
                  path: { points: [leg.from, leg.to] },
                  referenceSide: 'CENTER',
                  assemblyId: `assembly-${leg.thicknessMm ?? 300}`,
                  baseOffsetMm: 0,
                  heightMode: 'EXPLICIT',
                  heightMm: 2500,
                  role: leg.role ?? 'EXTERIOR',
                }) as unknown as (typeof level.walls)[number],
            ),
          },
        ],
      },
    };
  }

  const patchOf = (first: Leg, second: Leg): ScenePrimitive | undefined => {
    const { primitives } = buildPlanView(junction(first, second));
    const [a, b] = [first.id, second.id].sort();
    return find(primitives, `wall-join:${a}:${b}`);
  };

  /** Signed distance of a point from a wall's centre line. */
  const offsetFrom = (
    leg: Leg,
    point: { readonly x: number; readonly y: number },
  ): number => {
    const dx = leg.to.x - leg.from.x;
    const dy = leg.to.y - leg.from.y;
    const length = Math.hypot(dx, dy);
    return Math.abs(
      ((point.x - leg.from.x) * -dy + (point.y - leg.from.y) * dx) / length,
    );
  };

  const cases: readonly (readonly [string, Leg, Leg, string])[] = [
    [
      'a right-angle corner',
      { id: 'w-a', from: { x: -4_000, y: 0 }, to: { x: 0, y: 0 } },
      { id: 'w-b', from: { x: 0, y: 0 }, to: { x: 0, y: 4_000 } },
      'L',
    ],
    [
      'a wall dying into another',
      { id: 'w-a', from: { x: 0, y: 0 }, to: { x: 6_000, y: 0 } },
      { id: 'w-b', from: { x: 3_000, y: 0 }, to: { x: 3_000, y: 4_000 } },
      'T',
    ],
    [
      'a crossing',
      { id: 'w-a', from: { x: 0, y: 0 }, to: { x: 6_000, y: 0 } },
      { id: 'w-b', from: { x: 3_000, y: -2_000 }, to: { x: 3_000, y: 2_000 } },
      'X',
    ],
    [
      'an acute angle',
      { id: 'w-a', from: { x: 0, y: 0 }, to: { x: 6_000, y: 0 } },
      { id: 'w-b', from: { x: 0, y: 0 }, to: { x: 6_000, y: 3_000 } },
      'L',
    ],
    [
      'an obtuse angle',
      { id: 'w-a', from: { x: 0, y: 0 }, to: { x: 6_000, y: 0 } },
      { id: 'w-b', from: { x: 0, y: 0 }, to: { x: -4_000, y: 4_000 } },
      'L',
    ],
    [
      'a partition meeting an outer wall',
      {
        id: 'w-a',
        from: { x: 0, y: 0 },
        to: { x: 6_000, y: 0 },
        thicknessMm: 400,
        role: 'EXTERIOR',
      },
      {
        id: 'w-b',
        from: { x: 3_000, y: 0 },
        to: { x: 3_000, y: 4_000 },
        thicknessMm: 100,
        role: 'PARTITION',
      },
      'T',
    ],
  ];

  it.each(cases)('closes %s', (_name, first, second, kind) => {
    const patch = patchOf(first, second);
    expect(patch?.metadata?.joinKind).toBe(kind);
    expect(patch?.geometry.kind).toBe('POLYGON');
    if (patch?.geometry.kind !== 'POLYGON') return;
    expect(patch.geometry.polygon.outer).toHaveLength(4);
    // No spike past a face: every corner of the patch sits exactly on both
    // walls' faces, which is where the masonry of a mitre ends.
    for (const point of patch.geometry.polygon.outer) {
      expect(offsetFrom(first, point)).toBeCloseTo(
        (first.thicknessMm ?? 300) / 2,
        6,
      );
      expect(offsetFrom(second, point)).toBeCloseTo(
        (second.thicknessMm ?? 300) / 2,
        6,
      );
    }
  });

  it('fills the quadrant neither wall covers', () => {
    // The notch: outside the end of the horizontal wall, and on the far side
    // of the vertical one. Neither rectangle reaches it.
    const [first, second] = [cases[0]![1], cases[0]![2]];
    const patch = patchOf(first, second)!;
    if (patch.geometry.kind !== 'POLYGON') return;
    expect(polygonContains(patch.geometry.polygon, { x: 100, y: -100 })).toBe(
      true,
    );
    expect(polygonContains(patch.geometry.polygon, { x: 200, y: -100 })).toBe(
      false,
    );
  });

  it('gives the corner to the heavier of the two walls', () => {
    // A partition dies into a party wall, not the other way round.
    const [, first, second] = cases[5]!;
    expect(patchOf(first, second)?.metadata?.role).toBe('EXTERIOR');
  });

  it('draws no corner where two walls are all but parallel', () => {
    // The patch of a one-degree corner is metres long and is not a corner.
    expect(
      patchOf(
        { id: 'w-a', from: { x: 0, y: 0 }, to: { x: 6_000, y: 0 } },
        { id: 'w-b', from: { x: 0, y: 0 }, to: { x: 6_000, y: 60 } },
      ),
    ).toBeUndefined();
  });
});
