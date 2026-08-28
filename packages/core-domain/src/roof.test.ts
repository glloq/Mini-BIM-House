import { describe, expect, it } from 'vitest';
import { assemblyId } from '@house-technical-designer/assemblies';
import { entityId } from './ids.js';
import {
  deriveRoofPlanes,
  roofEaveOutline,
  roofRidgeElevationMm,
  validateRoof,
  type Roof,
  type RoofEdge,
} from './roof.js';

/** A ten by eight metre rectangle, drawn counter-clockwise. */
const RECTANGLE = [
  { x: 0, y: 0 },
  { x: 10_000, y: 0 },
  { x: 10_000, y: 8000 },
  { x: 0, y: 8000 },
];

function roof(
  edges: readonly RoofEdge[],
  outer: readonly { x: number; y: number }[] = RECTANGLE,
): Roof {
  return {
    id: entityId<'Roof'>('roof'),
    type: 'ROOF',
    levelId: entityId<'Level'>('ground'),
    footprint: { outer },
    edges,
    assemblyId: assemblyId('assembly-roof'),
    baseElevationMm: 2500,
  };
}

/** Un L : deux ailes, un sommet rentrant, donc une noue. */
const L_SHAPE = [
  { x: 0, y: 0 },
  { x: 10_000, y: 0 },
  { x: 10_000, y: 4000 },
  { x: 5000, y: 4000 },
  { x: 5000, y: 8000 },
  { x: 0, y: 8000 },
];

const sloped = (slopeDeg: number, overhangMm = 0): RoofEdge => ({
  kind: 'SLOPED',
  slopeDeg,
  overhangMm,
});
const gable = (overhangMm = 0): RoofEdge => ({
  kind: 'GABLE',
  slopeDeg: 0,
  overhangMm,
});

describe('what a roof has to say about itself', () => {
  it('refuses an outline whose sides are not all described', () => {
    expect(validateRoof(roof([sloped(30)]))).toContain(
      'edges must describe each of the 4 sides of the outline',
    );
  });

  it('refuses a roof with no sloped side', () => {
    expect(validateRoof(roof([gable(), gable(), gable(), gable()]))).toContain(
      'a roof needs at least one sloped side',
    );
  });

  it('refuses a pitch that is flat or vertical', () => {
    expect(
      validateRoof(roof([sloped(90), gable(), sloped(30), gable()])).join(' '),
    ).toContain('slopeDeg');
  });

  it('accepts a two-sided roof', () => {
    expect(
      validateRoof(roof([sloped(30), gable(), sloped(30), gable()])),
    ).toEqual([]);
  });
});

describe('where the eaves run', () => {
  it('pushes each side out by its own overhang', () => {
    const outline = roofEaveOutline(
      roof([sloped(30, 500), gable(300), sloped(30, 500), gable(300)]),
    ).outer;
    // The south side moved 500 mm south, the east side 300 mm east.
    expect(outline[0]).toEqual({ x: -300, y: -500 });
    expect(outline[1]).toEqual({ x: 10_300, y: -500 });
  });

  it('leaves the outline alone when nothing overhangs', () => {
    const outline = roofEaveOutline(
      roof([sloped(30), sloped(30), sloped(30), sloped(30)]),
    ).outer;
    expect(outline[0]!.x).toBeCloseTo(0, 6);
    expect(outline[2]!.y).toBeCloseTo(8000, 6);
  });
});

describe('the planes a roof is made of', () => {
  it('splits a two-sided roof at the middle when both pitches agree', () => {
    const result = deriveRoofPlanes(
      roof([sloped(30), gable(), sloped(30), gable()]),
    );
    expect(result.status).toBe('DERIVED');
    expect(result.planes).toHaveLength(2);
    // Eight metres between the two eaves, so the ridge sits four in.
    const first = result.planes[0]!;
    expect(first.footprint.outer[2]!.y).toBeCloseTo(4000, 6);
  });

  it('puts the ridge off centre when the pitches differ', () => {
    // A 60° side climbs faster than a 30° one, so they meet nearer the steep
    // eave: tan 30 / (tan 30 + tan 60) of the span.
    const result = deriveRoofPlanes(
      roof([sloped(60), gable(), sloped(30), gable()]),
    );
    const expected =
      (8000 * Math.tan(Math.PI / 6)) /
      (Math.tan(Math.PI / 3) + Math.tan(Math.PI / 6));
    expect(result.planes[0]!.footprint.outer[2]!.y).toBeCloseTo(expected, 3);
  });

  it('lets a single pitch climb the whole span when it faces a gable', () => {
    const result = deriveRoofPlanes(
      roof([sloped(20), gable(), gable(), gable()]),
    );
    expect(result.planes).toHaveLength(1);
    expect(result.planes[0]!.footprint.outer[2]!.y).toBeCloseTo(8000, 6);
  });

  it('gives four planes to a hipped roof', () => {
    const result = deriveRoofPlanes(
      roof([sloped(35), sloped(35), sloped(35), sloped(35)]),
    );
    expect(result.status).toBe('DERIVED');
    expect(result.planes).toHaveLength(4);
  });

  it('faces each plane the way its eave looks', () => {
    const result = deriveRoofPlanes(
      roof([sloped(30), gable(), sloped(30), gable()]),
    );
    // The first side runs east along y = 0, so its plane looks south.
    expect(result.planes[0]!.azimuthDeg).toBeCloseTo(-90, 6);
    expect(Math.abs(result.planes[1]!.azimuthDeg)).toBeCloseTo(90, 6);
  });

  it('donne six pans à un L, et la noue qui va avec', () => {
    /*
     * Un L a une noue, et le squelette droit la trouve, la place et referme
     * les deux fronts qu'elle sépare. Ce test disait l'inverse — que ces pans
     * restaient hors de toute aire comptée — et il ne le dit plus : un L est
     * la forme de maison la plus courante après le rectangle.
     */
    const result = deriveRoofPlanes(
      roof(
        L_SHAPE.map(() => sloped(30)),
        L_SHAPE,
      ),
    );
    expect(result.status).toBe('DERIVED');
    expect(result.planes).toHaveLength(6);
    const covered = result.planes.reduce(
      (total, plane) => total + areaOf(plane.footprint.outer),
      0,
    );
    expect(covered).toBeCloseTo(areaOf(L_SHAPE), 3);
  });
});

describe('how high a roof stands', () => {
  it('measures the ridge from the pitch and the span', () => {
    // Four metres of run at 30° above eaves at 2,50 m.
    expect(
      roofRidgeElevationMm(roof([sloped(30), gable(), sloped(30), gable()])),
    ).toBeCloseTo(2500 + 4000 * Math.tan(Math.PI / 6), 6);
  });

  it('solves a triangle, which is convex like any other', () => {
    // The construction does not know what a rectangle is; it knows that the
    // roof is the lowest of the surfaces climbing from its eaves.
    const triangle = [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 3000, y: 5000 },
    ];
    const height = roofRidgeElevationMm(
      roof([sloped(30), sloped(30), sloped(30)], triangle),
    );
    expect(height).toBeDefined();
    expect(height!).toBeGreaterThan(2500);
  });

  it('mesure le faîtage d’un L à son endroit le plus large', () => {
    /*
     * Le point le plus haut d'une toiture de pente uniforme est celui qui est
     * le plus loin de tout égout : le centre du plus grand cercle inscrit. Sur
     * ce L, l'aile verticale fait cinq mètres de large, donc deux mètres
     * cinquante — c'est plus que les deux mètres de la barre horizontale.
     */
    const height = roofRidgeElevationMm(
      roof(
        L_SHAPE.map(() => sloped(30)),
        L_SHAPE,
      ),
    );
    expect(height).toBeCloseTo(2500 + 2500 * Math.tan(Math.PI / 6), 3);
  });
});

/** Twice the signed area of an outline, in square millimetres. */
function areaOf(outline: readonly { x: number; y: number }[]): number {
  let total = 0;
  for (let index = 0; index < outline.length; index += 1) {
    const current = outline[index]!;
    const next = outline[(index + 1) % outline.length]!;
    total += current.x * next.y - next.x * current.y;
  }
  return Math.abs(total) / 2;
}

/** Whether a point is inside an outline, by the crossing-number rule. */
function inside(
  point: { x: number; y: number },
  outline: readonly { x: number; y: number }[],
): boolean {
  let within = false;
  for (
    let index = 0, previous = outline.length - 1;
    index < outline.length;
    previous = index, index += 1
  ) {
    const current = outline[index]!;
    const last = outline[previous]!;
    if (current.y > point.y === last.y > point.y) continue;
    const crossingX =
      ((last.x - current.x) * (point.y - current.y)) / (last.y - current.y) +
      current.x;
    if (point.x < crossingX) within = !within;
  }
  return within;
}

/**
 * The invariants that make a set of planes a roof rather than a pile of
 * quadrilaterals.
 *
 * These are the tests that were missing: counting the planes says nothing
 * about whether they cover the roof once. A hip roof whose four planes each
 * ran the whole length of their eave counted the middle of the house twice,
 * and every area derived from it — quantities, thermal envelope, solar — was
 * wrong without anything saying so.
 */
describe('the invariants of a derived roof', () => {
  const CASES: readonly (readonly [string, readonly RoofEdge[]])[] = [
    ['deux pans', [sloped(30), gable(), sloped(30), gable()]],
    ['deux pans dissymétriques', [sloped(45), gable(), sloped(25), gable()]],
    ['monopente', [sloped(15), gable(), gable(), gable()]],
    ['quatre pans', [sloped(35), sloped(35), sloped(35), sloped(35)]],
    [
      'quatre pans de pentes différentes',
      [sloped(40), sloped(25), sloped(30), sloped(35)],
    ],
    ['trois pans et un pignon', [sloped(30), sloped(30), sloped(30), gable()]],
  ];

  it.each(CASES)('couvre exactement l’emprise : %s', (_name, edges) => {
    const subject = roof(edges);
    const result = deriveRoofPlanes(subject);
    expect(result.status).toBe('DERIVED');
    const covered = result.planes.reduce(
      (total, plane) => total + areaOf(plane.footprint.outer),
      0,
    );
    // The sum of the projected faces is the area under the eaves — no more,
    // which would be a plane counted twice, and no less, which would be a
    // patch of roof nothing covers.
    expect(covered).toBeCloseTo(areaOf(roofEaveOutline(subject).outer), 3);
  });

  it.each(CASES)('ne fait se chevaucher aucun pan : %s', (_name, edges) => {
    const result = deriveRoofPlanes(roof(edges));
    for (const plane of result.planes) {
      const centre = plane.footprint.outer.reduce(
        (total, point) => ({
          x: total.x + point.x / plane.footprint.outer.length,
          y: total.y + point.y / plane.footprint.outer.length,
        }),
        { x: 0, y: 0 },
      );
      const holders = result.planes.filter((candidate) =>
        inside(centre, candidate.footprint.outer),
      );
      // The middle of a face belongs to that face and to no other.
      expect(holders.map(({ id }) => id)).toEqual([plane.id]);
    }
  });

  it('meets at one ridge when the two pitches agree', () => {
    // Both faces of a symmetrical two-sided roof are the same size.
    const result = deriveRoofPlanes(
      roof([sloped(30), gable(), sloped(30), gable()]),
    );
    const [first, second] = result.planes;
    expect(areaOf(first!.footprint.outer)).toBeCloseTo(
      areaOf(second!.footprint.outer),
      3,
    );
  });

  it('gives the steeper side of a hip roof the smaller face', () => {
    // It climbs faster, so it reaches the ridge sooner and covers less ground.
    const result = deriveRoofPlanes(
      roof([sloped(60), sloped(30), sloped(30), sloped(30)]),
    );
    const steep = result.planes.find(({ slopeDeg }) => slopeDeg === 60)!;
    const shallow = result.planes.find(({ slopeDeg }) => slopeDeg === 30)!;
    expect(areaOf(steep.footprint.outer)).toBeLessThan(
      areaOf(shallow.footprint.outer),
    );
  });

  const CONCAVE: readonly (readonly [
    string,
    readonly { x: number; y: number }[],
  ])[] = [
    ['un L', L_SHAPE],
    [
      'un U',
      [
        { x: 0, y: 0 },
        { x: 12_000, y: 0 },
        { x: 12_000, y: 9000 },
        { x: 9000, y: 9000 },
        { x: 9000, y: 3000 },
        { x: 3000, y: 3000 },
        { x: 3000, y: 9000 },
        { x: 0, y: 9000 },
      ],
    ],
    [
      'un T',
      [
        { x: 0, y: 0 },
        { x: 12_000, y: 0 },
        { x: 12_000, y: 4000 },
        { x: 8000, y: 4000 },
        { x: 8000, y: 10_000 },
        { x: 4000, y: 10_000 },
        { x: 4000, y: 4000 },
        { x: 0, y: 4000 },
      ],
    ],
  ];

  it.each(CONCAVE)(
    'couvre exactement l’emprise rentrante : %s',
    (_n, outer) => {
      const subject = roof(
        outer.map(() => sloped(32)),
        outer,
      );
      const result = deriveRoofPlanes(subject);
      expect(result.status).toBe('DERIVED');
      const covered = result.planes.reduce(
        (total, plane) => total + areaOf(plane.footprint.outer),
        0,
      );
      expect(covered).toBeCloseTo(areaOf(roofEaveOutline(subject).outer), 3);
    },
  );

  it.each(CONCAVE)('ne fait se chevaucher aucun pan rentrant : %s', (_n, o) => {
    /*
     * L'aire seule ne suffit pas : deux pans mal ordonnés peuvent se croiser
     * et garder la bonne somme. Ce test regarde le milieu de chaque pan et
     * exige qu'il n'appartienne qu'à lui — c'est ce qui a attrapé un tri des
     * sommets par angle qui échangeait deux points au fond d'une branche.
     */
    const result = deriveRoofPlanes(
      roof(
        o.map(() => sloped(32)),
        o,
      ),
    );
    for (const plane of result.planes) {
      const centre = plane.footprint.outer.reduce(
        (total, point) => ({
          x: total.x + point.x / plane.footprint.outer.length,
          y: total.y + point.y / plane.footprint.outer.length,
        }),
        { x: 0, y: 0 },
      );
      const holders = result.planes.filter((candidate) =>
        inside(centre, candidate.footprint.outer),
      );
      expect(holders.map(({ id }) => id)).toEqual([plane.id]);
    }
  });

  it('covers the overhang as well as the outline', () => {
    const withEaves = roof([
      sloped(35, 500),
      sloped(35, 500),
      sloped(35, 500),
      sloped(35, 500),
    ]);
    const covered = deriveRoofPlanes(withEaves).planes.reduce(
      (total, plane) => total + areaOf(plane.footprint.outer),
      0,
    );
    // Eleven by nine metres once the half-metre overhang is counted.
    expect(covered).toBeCloseTo(11_000 * 9000, 3);
  });
});
