import { describe, expect, it } from 'vitest';

import { interiorLabelPoint } from './label-point.js';
import { polygonContains } from './operations.js';
import type { Polygon2D } from './types.js';

const rectangle: Polygon2D = {
  outer: [
    { x: 0, y: 0 },
    { x: 4_000, y: 0 },
    { x: 4_000, y: 3_000 },
    { x: 0, y: 3_000 },
  ],
};

// An L: the average of the vertices of this outline falls in the notch.
const ell: Polygon2D = {
  outer: [
    { x: 0, y: 0 },
    { x: 6_000, y: 0 },
    { x: 6_000, y: 2_000 },
    { x: 2_000, y: 2_000 },
    { x: 2_000, y: 6_000 },
    { x: 0, y: 6_000 },
  ],
};

const donut: Polygon2D = {
  outer: [
    { x: 0, y: 0 },
    { x: 6_000, y: 0 },
    { x: 6_000, y: 6_000 },
    { x: 0, y: 6_000 },
  ],
  holes: [
    [
      { x: 2_000, y: 2_000 },
      { x: 4_000, y: 2_000 },
      { x: 4_000, y: 4_000 },
      { x: 2_000, y: 4_000 },
    ],
  ],
};

const average = (polygon: Polygon2D): { x: number; y: number } => {
  const sum = polygon.outer.reduce(
    (total, point) => ({ x: total.x + point.x, y: total.y + point.y }),
    { x: 0, y: 0 },
  );
  return {
    x: sum.x / polygon.outer.length,
    y: sum.y / polygon.outer.length,
  };
};

describe('where a label goes in a shape', () => {
  it('sits at the centre of a rectangle', () => {
    const placement = interiorLabelPoint(rectangle);
    expect(placement?.point.x).toBeCloseTo(2_000, -2);
    expect(placement?.point.y).toBeCloseTo(1_500, -2);
    expect(placement?.clearance).toBeCloseTo(1_500, -2);
  });

  it('stays inside an L, where the average of the vertices does not', () => {
    // The name of an L-shaped room used to land in the corridor next door, and
    // a name in the wrong room is worse than no name at all.
    expect(polygonContains(ell, average(ell))).toBe(false);
    const placement = interiorLabelPoint(ell);
    expect(placement).toBeDefined();
    expect(polygonContains(ell, placement!.point)).toBe(true);
    expect(placement!.clearance).toBeGreaterThan(900);
  });

  it('keeps out of a hole', () => {
    const placement = interiorLabelPoint(donut);
    expect(placement).toBeDefined();
    expect(polygonContains(donut, placement!.point)).toBe(true);
    expect(placement!.clearance).toBeGreaterThan(500);
  });

  it('measures the width a text centred on the point may take', () => {
    // A corridor four metres long and one wide holds its name comfortably, and
    // no circle inscribed in it says so.
    const corridor = interiorLabelPoint({
      outer: [
        { x: 0, y: 0 },
        { x: 4_000, y: 0 },
        { x: 4_000, y: 1_000 },
        { x: 0, y: 1_000 },
      ],
    })!;
    expect(corridor.clearance).toBeCloseTo(500, -1);
    expect(corridor.horizontalSpan).toBeCloseTo(4_000, -2);
    // In an L the span stops at the notch, not at the bounding box.
    const inside = interiorLabelPoint(ell)!;
    expect(inside.horizontalSpan).toBeLessThanOrEqual(6_000);
    expect(inside.horizontalSpan).toBeGreaterThan(0);
  });

  it('reports the clearance a caller needs to size its text', () => {
    const narrow = interiorLabelPoint({
      outer: [
        { x: 0, y: 0 },
        { x: 4_000, y: 0 },
        { x: 4_000, y: 600 },
        { x: 0, y: 600 },
      ],
    });
    expect(narrow?.clearance).toBeCloseTo(300, -1);
    expect(interiorLabelPoint(rectangle)!.clearance).toBeGreaterThan(
      narrow!.clearance,
    );
  });

  it('answers nothing rather than a point outside the shape', () => {
    expect(interiorLabelPoint({ outer: [] })).toBeUndefined();
    expect(
      interiorLabelPoint({
        outer: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
      }),
    ).toBeUndefined();
    // A degenerate outline has no inside to write in.
    expect(
      interiorLabelPoint({
        outer: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 200, y: 0 },
        ],
      }),
    ).toBeUndefined();
  });

  it('answers the same point for the same shape', () => {
    const first = interiorLabelPoint(ell);
    const second = interiorLabelPoint(ell);
    expect(second).toEqual(first);
  });
});
