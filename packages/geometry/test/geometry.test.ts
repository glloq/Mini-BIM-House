import { describe, expect, it } from 'vitest';

import {
  boundingBox2D,
  boundingBox3D,
  distance2D,
  distance3D,
  polygonArea,
  polylineLength,
  signedArea,
  validatePolygon,
  validatePolyline,
  validateSegment,
} from '../src/index.js';

describe('distance and bounds', () => {
  it('computes analytical 2D and 3D distances in millimetres', () => {
    expect(distance2D({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distance3D({ x: 0, y: 0, z: 0 }, { x: 2, y: 3, z: 6 })).toBe(7);
  });

  it('handles small distances and large coordinates without rounding', () => {
    expect(
      distance2D({ x: 1e9, y: 1e9 }, { x: 1e9 + 0.001, y: 1e9 }),
    ).toBeCloseTo(0.001, 6);
  });

  it('returns undefined for an empty bounding set', () => {
    expect(boundingBox2D([])).toBeUndefined();
  });

  it('computes 2D and 3D extrema', () => {
    expect(
      boundingBox2D([
        { x: 4, y: -2 },
        { x: -1, y: 8 },
      ]),
    ).toEqual({
      min: { x: -1, y: -2 },
      max: { x: 4, y: 8 },
    });
    expect(
      boundingBox3D([
        { x: 4, y: -2, z: 9 },
        { x: -1, y: 8, z: -3 },
      ]),
    ).toEqual({
      min: { x: -1, y: -2, z: -3 },
      max: { x: 4, y: 8, z: 9 },
    });
  });
});

describe('polyline and polygon operations', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it('includes the closing edge only for closed polylines', () => {
    expect(polylineLength({ points: square, closed: false })).toBe(30);
    expect(polylineLength({ points: square, closed: true })).toBe(40);
  });

  it('reports orientation while keeping polygon area orientation-independent', () => {
    expect(signedArea(square)).toBe(100);
    expect(signedArea([...square].reverse())).toBe(-100);
    expect(polygonArea({ outer: [...square].reverse() })).toBe(100);
  });

  it('subtracts holes regardless of ring orientation', () => {
    const hole = [
      { x: 2, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 4 },
      { x: 2, y: 4 },
    ];
    expect(polygonArea({ outer: square, holes: [hole] })).toBe(96);
  });
});

describe('validation diagnostics', () => {
  it('rejects zero and near-zero segments with the central tolerance', () => {
    expect(
      validateSegment({ start: { x: 1, y: 1 }, end: { x: 1, y: 1 } })[0]?.code,
    ).toBe('DEGENERATE_SEGMENT');
    expect(
      validateSegment(
        { start: { x: 0, y: 0 }, end: { x: 0.01, y: 0 } },
        {
          pointMergeMm: 0.1,
          collinearMm: 1e-6,
          angularRad: 1e-9,
          areaMm2: 1e-6,
        },
      )[0]?.code,
    ).toBe('DEGENERATE_SEGMENT');
  });

  it('rejects non-finite coordinates and insufficient points', () => {
    expect(
      validateSegment({
        start: { x: Number.NaN, y: 0 },
        end: { x: 1, y: 0 },
      })[0]?.code,
    ).toBe('NON_FINITE_COORDINATE');
    expect(
      validatePolyline({ points: [{ x: 0, y: 0 }], closed: false })[0]?.code,
    ).toBe('INSUFFICIENT_POINTS');
  });

  it('rejects collinear zero-area polygons', () => {
    expect(
      validatePolygon({
        outer: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
        ],
      })[0]?.code,
    ).toBe('DEGENERATE_POLYGON');
  });

  it('rejects a self-intersecting ring with non-zero signed area', () => {
    const crossing = [
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 5 },
      { x: 5, y: 0 },
    ];
    expect(validatePolygon({ outer: crossing })[0]?.code).toBe(
      'SELF_INTERSECTION',
    );
  });

  it.each([
    [
      'degenerate hole',
      [
        [
          { x: 2, y: 2 },
          { x: 3, y: 2 },
          { x: 4, y: 2 },
        ],
      ],
      'DEGENERATE_POLYGON',
    ],
    [
      'outside hole',
      [
        [
          { x: 12, y: 2 },
          { x: 14, y: 2 },
          { x: 14, y: 4 },
          { x: 12, y: 4 },
        ],
      ],
      'HOLE_OUTSIDE_OUTER',
    ],
    [
      'crossing hole',
      [
        [
          { x: 8, y: 2 },
          { x: 12, y: 2 },
          { x: 12, y: 4 },
          { x: 8, y: 4 },
        ],
      ],
      'RING_INTERSECTION',
    ],
    [
      'touching hole',
      [
        [
          { x: 0, y: 2 },
          { x: 2, y: 2 },
          { x: 2, y: 4 },
          { x: 0, y: 4 },
        ],
      ],
      'RING_INTERSECTION',
    ],
    [
      'intersecting holes',
      [
        [
          { x: 2, y: 2 },
          { x: 6, y: 2 },
          { x: 6, y: 6 },
          { x: 2, y: 6 },
        ],
        [
          { x: 5, y: 5 },
          { x: 8, y: 5 },
          { x: 8, y: 8 },
          { x: 5, y: 8 },
        ],
      ],
      'HOLE_OVERLAP',
    ],
    [
      'contained hole',
      [
        [
          { x: 2, y: 2 },
          { x: 8, y: 2 },
          { x: 8, y: 8 },
          { x: 2, y: 8 },
        ],
        [
          { x: 3, y: 3 },
          { x: 4, y: 3 },
          { x: 4, y: 4 },
          { x: 3, y: 4 },
        ],
      ],
      'HOLE_OVERLAP',
    ],
    [
      'self-intersecting hole',
      [
        [
          { x: 2, y: 2 },
          { x: 7, y: 7 },
          { x: 2, y: 8 },
          { x: 8, y: 2 },
        ],
      ],
      'SELF_INTERSECTION',
    ],
  ] as const)('rejects %s', (_label, holes, code) => {
    const outer = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(validatePolygon({ outer, holes })[0]?.code).toBe(code);
  });
});
