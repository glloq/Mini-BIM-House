import { describe, expect, it } from 'vitest';
import type {
  Project,
  SavedDrawingView,
} from '@house-technical-designer/core-domain';
import { entityId } from '@house-technical-designer/core-domain';
import type { ScenePrimitive } from '@house-technical-designer/drawing-engine';
import {
  buildElevationView,
  buildRoofView,
  buildSectionView,
  buildSiteView,
} from './section-view.js';
import { buildSavedDrawing } from './saved-drawing.js';

const levelId = entityId<'Level'>('ground');
const wallAssembly = 'wall-assembly' as never;

/**
 * A rectangular house, four metres deep, with a window in its south wall and a
 * two-pitch roof whose ridge runs east-west across the middle.
 */
function house(): Project {
  return {
    id: entityId<'Project'>('section-fixture'),
    metadata: {
      name: 'Section fixture',
      createdAt: '2026-08-21T00:00:00Z',
      updatedAt: '2026-08-21T00:00:00Z',
    },
    site: {
      northAngleDeg: 0,
      parcelBoundary: {
        outer: [
          { x: -4000, y: -4000 },
          { x: 10_000, y: -4000 },
          { x: 10_000, y: 8000 },
          { x: -4000, y: 8000 },
        ],
      },
      obstacles: [
        {
          id: entityId('tree'),
          boundary: {
            outer: [
              { x: 8000, y: 6000 },
              { x: 9000, y: 6000 },
              { x: 9000, y: 7000 },
              { x: 8000, y: 7000 },
            ],
          },
          kind: 'TREE',
          heightMm: 8000,
        },
      ],
    },
    materialLibrary: {
      materials: [
        {
          id: 'masonry' as never,
          name: 'Maçonnerie',
          kind: 'GENERIC',
          properties: { lambdaWmK: 0.8 },
        },
      ],
    },
    assemblies: [
      {
        id: wallAssembly,
        name: 'Mur',
        category: 'WALL',
        layers: [
          {
            id: 'masonry-layer' as never,
            materialId: 'masonry' as never,
            thicknessM: 0.3,
            role: 'STRUCTURAL',
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
              assemblyId: wallAssembly,
              baseOffsetMm: 0,
              heightMode: 'EXPLICIT',
              heightMm: 2500,
              role: 'EXTERIOR',
            },
            {
              id: entityId<'Wall'>('wall-north'),
              type: 'WALL',
              levelId,
              path: {
                points: [
                  { x: 0, y: 4000 },
                  { x: 6000, y: 4000 },
                ],
              },
              referenceSide: 'CENTER',
              assemblyId: wallAssembly,
              baseOffsetMm: 0,
              heightMode: 'EXPLICIT',
              heightMm: 2500,
              role: 'EXTERIOR',
            },
          ],
          openings: [
            {
              id: entityId<'Opening'>('south-window'),
              type: 'OPENING',
              openingType: 'WINDOW',
              hostElementId: entityId<'Wall'>('wall-south'),
              offsetAlongHostMm: 2400,
              sillHeightMm: 900,
              widthMm: 1200,
              heightMm: 1200,
            },
          ],
          slabs: [
            {
              id: entityId<'Slab'>('floor'),
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
              assemblyId: wallAssembly,
              elevationOffsetMm: 0,
              role: 'FLOOR',
            },
          ],
          roofs: [
            {
              id: entityId<'RoofPlane'>('roof-south'),
              type: 'ROOF_PLANE',
              levelId,
              footprint: {
                outer: [
                  { x: 0, y: 0 },
                  { x: 6000, y: 0 },
                  { x: 6000, y: 2000 },
                  { x: 0, y: 2000 },
                ],
              },
              assemblyId: wallAssembly,
              slopeDeg: 30,
              azimuthDeg: 270,
              baseElevationMm: 2500,
            },
            {
              id: entityId<'RoofPlane'>('roof-north'),
              type: 'ROOF_PLANE',
              levelId,
              footprint: {
                outer: [
                  { x: 0, y: 2000 },
                  { x: 6000, y: 2000 },
                  { x: 6000, y: 4000 },
                  { x: 0, y: 4000 },
                ],
              },
              assemblyId: wallAssembly,
              slopeDeg: 30,
              azimuthDeg: 90,
              baseElevationMm: 2500,
            },
          ],
          spaces: [],
          stairs: [],
          annotations: [],
        },
      ],
      zones: [],
    },
    systems: [],
  };
}

/** The cut runs north-south through the middle of the house. */
const CUT = {
  line: { start: { x: 3000, y: -2000 }, end: { x: 3000, y: 6000 } },
} as const;

function of(
  primitives: readonly ScenePrimitive[],
  sourceObjectId: string,
): readonly ScenePrimitive[] {
  return primitives.filter(
    (primitive) => primitive.sourceObjectId === sourceObjectId,
  );
}

function heights(primitive: ScenePrimitive): readonly number[] {
  if (primitive.geometry.kind !== 'POLYGON') return [];
  return [...new Set(primitive.geometry.polygon.outer.map(({ y }) => y))].sort(
    (first, second) => first - second,
  );
}

function span(primitive: ScenePrimitive): readonly number[] {
  if (primitive.geometry.kind !== 'POLYGON') return [];
  return [...new Set(primitive.geometry.polygon.outer.map(({ x }) => x))].sort(
    (first, second) => first - second,
  );
}

describe('a section of the house', () => {
  it('draws every wall the cut passes through, where it passes', () => {
    const { primitives } = buildSectionView(house(), CUT);
    // The south wall is 2 000 mm along the cut from its start, the north wall
    // 6 000: the drawing is a projection and not a copy of the plan.
    expect(span(of(primitives, 'wall-north')[0]!)).toEqual([5850, 6150]);
  });

  it('cuts a wall as thick as what it is built of', () => {
    // 300 mm of masonry, not a constant nobody chose.
    const { primitives } = buildSectionView(house(), CUT);
    const [left, right] = span(of(primitives, 'wall-north')[0]!);
    expect(right! - left!).toBe(300);
  });

  it('leaves the gap where the saw went through a window', () => {
    const { primitives } = buildSectionView(house(), CUT);
    const window = of(primitives, 'south-window')[0]!;
    expect(window.semanticRole).toBe('OPENING');
    expect(heights(window)).toEqual([900, 2100]);
    // The masonry stops at the sill and starts again at the head.
    expect(of(primitives, 'wall-south').map(heights)).toEqual([
      [0, 900],
      [2100, 2500],
    ]);
  });

  it('does not saw through a window the cut misses', () => {
    const moved = house();
    const off = {
      ...moved,
      building: {
        ...moved.building,
        levels: moved.building.levels.map((level) => ({
          ...level,
          openings: level.openings.map((opening) => ({
            ...opening,
            offsetAlongHostMm: 100,
          })),
        })),
      },
    };
    const { primitives } = buildSectionView(off, CUT);
    expect(of(primitives, 'south-window')).toEqual([]);
    expect(of(primitives, 'wall-south').map(heights)).toEqual([[0, 2500]]);
  });

  it('draws what stands behind the cut as background, not as masonry', () => {
    // A cut running east-west in front of the house: nothing is sawn, the
    // south wall is behind it, and drawing it black would be a lie about
    // where the saw went.
    const { primitives } = buildSectionView(house(), {
      line: { start: { x: -2000, y: -1000 }, end: { x: 8000, y: -1000 } },
      depthMm: 2000,
    });
    expect(of(primitives, 'wall-south')[0]?.semanticRole).toBe('WALL_BELOW');
    // Four metres away, past the depth asked for.
    expect(of(primitives, 'wall-north')).toEqual([]);
  });

  it('makes the roof climb toward the ridge and not along the pitch', () => {
    const { primitives } = buildSectionView(house(), CUT);
    const south = of(primitives, 'roof-south')[0]!;
    const north = of(primitives, 'roof-north')[0]!;
    // Both pans meet at the ridge, 2 000 mm of run at 30° above the eaves.
    const ridge = 2500 + 2000 * Math.tan(Math.PI / 6);
    expect(heights(south).at(-1)).toBeCloseTo(ridge + 200, 6);
    expect(heights(north).at(-1)).toBeCloseTo(ridge + 200, 6);
    expect(heights(south)[0]).toBeCloseTo(2500, 6);
  });

  it('keeps only the slice of height the view asks for', () => {
    const { primitives } = buildSectionView(house(), {
      ...CUT,
      verticalRangeMm: { minMm: 2600, maxMm: 6000 },
    });
    expect(of(primitives, 'wall-south')).toEqual([]);
    expect(of(primitives, 'roof-south')).not.toEqual([]);
  });

  it('says so rather than drawing a cut of no length', () => {
    const result = buildSectionView(house(), {
      line: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
    });
    expect(result.issues.map(({ code }) => code)).toEqual([
      'SECTION_EMPTY_CUT',
    ]);
    expect(result.primitives).toEqual([]);
  });

  it('is derived from the model, so a wall that moved is where it now is', () => {
    const before = buildSectionView(house(), CUT);
    const moved = house();
    const after = buildSectionView(
      {
        ...moved,
        building: {
          ...moved.building,
          levels: moved.building.levels.map((level) => ({
            ...level,
            walls: level.walls.map((wall) =>
              wall.id === 'wall-north'
                ? {
                    ...wall,
                    path: {
                      points: [
                        { x: 0, y: 5000 },
                        { x: 6000, y: 5000 },
                      ],
                    },
                  }
                : wall,
            ),
          })),
        },
      },
      CUT,
    );
    expect(span(of(before.primitives, 'wall-north')[0]!)).toEqual([5850, 6150]);
    expect(span(of(after.primitives, 'wall-north')[0]!)).toEqual([6850, 7150]);
  });

  it('draws the same house the same way twice', () => {
    expect(buildSectionView(house(), CUT).primitives).toEqual(
      buildSectionView(house(), CUT).primitives,
    );
  });
});

describe('a façade of the house', () => {
  it('draws the walls that face it and places their openings on them', () => {
    // Looking due south: the north wall is nearest, the south wall behind it.
    const { primitives } = buildElevationView(house(), { azimuthDeg: 270 });
    expect(of(primitives, 'wall-north')[0]?.semanticRole).toBe('WALL_CUT');
    expect(of(primitives, 'wall-south')[0]?.semanticRole).toBe('WALL_BELOW');
    expect(span(of(primitives, 'south-window')[0]!)).toEqual([2400, 3600]);
    expect(heights(of(primitives, 'south-window')[0]!)).toEqual([900, 2100]);
  });

  it('leaves out what is deeper into the house than asked', () => {
    const { primitives } = buildElevationView(house(), {
      azimuthDeg: 270,
      depthMm: 1000,
    });
    expect(of(primitives, 'wall-north')).not.toEqual([]);
    expect(of(primitives, 'wall-south')).toEqual([]);
  });

  it('does not draw a wall seen end-on as a black band across the façade', () => {
    // Looking due east, the two east-west walls are edges and nothing else.
    const { primitives } = buildElevationView(house(), { azimuthDeg: 0 });
    expect(of(primitives, 'wall-south')).toEqual([]);
  });
});

describe('the roof plan', () => {
  it('names the line where two pans meet', () => {
    const { primitives } = buildRoofView(house());
    const ridges = primitives.filter(({ id }) => id.includes('ridge'));
    expect(ridges).toHaveLength(1);
    expect(ridges[0]?.geometry).toMatchObject({
      polygon: {
        outer: [
          { x: 6000, y: 2000 },
          { x: 0, y: 2000 },
        ],
      },
    });
  });

  it('says which way each pan falls and how steeply', () => {
    const { primitives } = buildRoofView(house());
    const fall = primitives.find(({ id }) => id.includes('fall:roof-south'))!;
    expect(fall.metadata).toMatchObject({ slopeDeg: 30 });
    expect(fall.geometry.kind).toBe('POLYLINE');
    const plane = primitives.find(({ id }) => id.includes('plane:roof-south'))!;
    expect(plane.metadata).toMatchObject({ slopeDeg: 30, azimuthDeg: 270 });
  });

  it('says a project with no roof has no roof plan to draw', () => {
    const bare = house();
    const result = buildRoofView({
      ...bare,
      building: {
        ...bare.building,
        levels: bare.building.levels.map((level) => ({ ...level, roofs: [] })),
      },
    });
    expect(result.issues.map(({ code }) => code)).toEqual(['ROOF_VIEW_EMPTY']);
  });
});

describe('the site plan', () => {
  it('draws the ground, what stands on it and the house', () => {
    const { primitives } = buildSiteView(house());
    expect(of(primitives, 'site:parcel')[0]?.discipline).toBe('SITE');
    expect(of(primitives, 'tree')[0]?.metadata).toMatchObject({
      kind: 'TREE',
      heightMm: 8000,
    });
    expect(of(primitives, 'wall-south')).not.toEqual([]);
  });

  it('says when the project never stated where the limits are', () => {
    const bare = house();
    const { parcelBoundary: _parcel, ...site } = bare.site;
    const result = buildSiteView({ ...bare, site });
    expect(result.issues.map(({ code }) => code)).toEqual([
      'SITE_VIEW_NO_PARCEL',
    ]);
  });
});

describe('a saved view, reopened', () => {
  function saved(overrides: Partial<SavedDrawingView>): SavedDrawingView {
    return {
      id: 'view-1',
      type: 'PLAN',
      name: 'Vue',
      scaleDenominator: 50,
      layers: {},
      graphicProfileId: 'generic-technical-screen',
      ...overrides,
    };
  }

  it('is drawn as the kind of view it says it is', () => {
    for (const [type, expected] of [
      ['PLAN', 'PLAN'],
      ['ROOF', 'ROOF'],
      ['SITE', 'SITE'],
    ] as const)
      expect(buildSavedDrawing(house(), saved({ type })).view.type, type).toBe(
        expected,
      );
  });

  it('cuts the section exactly where it was cut when it was saved', () => {
    const view = saved({
      type: 'SECTION',
      cut: { start: CUT.line.start, end: CUT.line.end },
    });
    expect(buildSavedDrawing(house(), view).primitives).toEqual(
      buildSectionView(house(), CUT, {
        viewId: 'view-1',
        scale: 50,
        graphicProfileId: 'generic-technical-screen',
      }).primitives,
    );
  });

  it('shows the house as it is now, cut where it was decided then', () => {
    // Capture, save, mutate, restore: the decision comes back exactly, the
    // geometry comes back as it now is.
    const view = saved({
      type: 'SECTION',
      cut: { start: CUT.line.start, end: CUT.line.end },
    });
    const raised = house();
    const after = buildSavedDrawing(
      {
        ...raised,
        building: {
          ...raised.building,
          levels: raised.building.levels.map((level) => ({
            ...level,
            walls: level.walls.map((wall) => ({
              ...wall,
              heightMode: 'EXPLICIT' as const,
              heightMm: 3000,
            })),
          })),
        },
      },
      view,
    );
    expect(span(of(after.primitives, 'wall-north')[0]!)).toEqual([5850, 6150]);
    expect(heights(of(after.primitives, 'wall-north')[0]!)).toEqual([0, 3000]);
  });

  it('opens a façade the way it was looked at', () => {
    const view = saved({
      type: 'ELEVATION',
      viewDirectionDeg: 270,
      viewDepthMm: 1000,
    });
    const built = buildSavedDrawing(house(), view);
    expect(built.view.type).toBe('ELEVATION');
    expect(built.view.viewDepthMm).toBe(1000);
    expect(of(built.primitives, 'wall-south')).toEqual([]);
  });

  it('opens empty rather than as something else when the line is gone', () => {
    const built = buildSavedDrawing(house(), saved({ type: 'SECTION' }));
    expect(built.view.type).toBe('SECTION');
    expect(built.primitives).toEqual([]);
    expect(built.issues.map(({ code }) => code)).toEqual([
      'VIEW_SECTION_WITHOUT_CUT',
    ]);
  });

  it('frames the window a sheet states rather than what it drew', () => {
    const viewport = {
      min: { x: 0, y: 0 },
      max: { x: 15_000, y: 12_000 },
    };
    const built = buildSavedDrawing(
      house(),
      saved({
        type: 'SECTION',
        cut: { start: CUT.line.start, end: CUT.line.end },
      }),
      { viewport },
    );
    expect(built.view.viewport).toEqual(viewport);
  });
});
