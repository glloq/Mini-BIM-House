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

function roof(edges: readonly RoofEdge[], outer = RECTANGLE): Roof {
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

  it('says what it cannot derive instead of inventing a ridge', () => {
    const lShape = [
      { x: 0, y: 0 },
      { x: 10_000, y: 0 },
      { x: 10_000, y: 4000 },
      { x: 5000, y: 4000 },
      { x: 5000, y: 8000 },
      { x: 0, y: 8000 },
    ];
    const result = deriveRoofPlanes(
      roof(
        lShape.map(() => sloped(30)),
        lShape,
      ),
    );
    expect(result.status).toBe('NOT_DERIVABLE');
    if (result.status !== 'NOT_DERIVABLE') return;
    expect(result.reason).toContain('rectangulaire');
    // What it is sure of is still offered: one plane standing on each side.
    expect(result.planes).toHaveLength(6);
  });
});

describe('how high a roof stands', () => {
  it('measures the ridge from the pitch and the span', () => {
    // Four metres of run at 30° above eaves at 2,50 m.
    expect(
      roofRidgeElevationMm(roof([sloped(30), gable(), sloped(30), gable()])),
    ).toBeCloseTo(2500 + 4000 * Math.tan(Math.PI / 6), 6);
  });

  it('says nothing rather than guessing on an outline it cannot solve', () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 3000, y: 5000 },
    ];
    expect(
      roofRidgeElevationMm(
        roof([sloped(30), sloped(30), sloped(30)], triangle),
      ),
    ).toBeUndefined();
  });
});
