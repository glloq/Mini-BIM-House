import { describe, expect, it } from 'vitest';
import {
  intersectSegments,
  normalizePolyline,
  offsetPolyline,
} from '../src/index.js';

describe('segment intersections', () => {
  it('finds an orthogonal crossing', () => {
    expect(
      intersectSegments(
        { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
        { start: { x: 5, y: -2 }, end: { x: 5, y: 2 } },
      ),
    ).toMatchObject({ kind: 'POINT', point: { x: 5, y: 0 } });
  });
  it('includes endpoint contact', () => {
    expect(
      intersectSegments(
        { start: { x: 0, y: 0 }, end: { x: 2, y: 0 } },
        { start: { x: 2, y: 0 }, end: { x: 2, y: 3 } },
      ).kind,
    ).toBe('POINT');
  });
  it('distinguishes parallel, overlap and degenerate cases', () => {
    expect(
      intersectSegments(
        { start: { x: 0, y: 0 }, end: { x: 2, y: 0 } },
        { start: { x: 0, y: 1 }, end: { x: 2, y: 1 } },
      ).kind,
    ).toBe('NONE');
    expect(
      intersectSegments(
        { start: { x: 0, y: 0 }, end: { x: 4, y: 0 } },
        { start: { x: 2, y: 0 }, end: { x: 6, y: 0 } },
      ).kind,
    ).toBe('OVERLAP');
    expect(
      intersectSegments(
        { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
        { start: { x: 0, y: 0 }, end: { x: 2, y: 0 } },
      ).kind,
    ).toBe('DEGENERATE');
  });
});

describe('normalization and simple offsets', () => {
  it('removes consecutive near-duplicate points', () => {
    expect(
      normalizePolyline({
        points: [
          { x: 0, y: 0 },
          { x: 1e-8, y: 0 },
          { x: 2, y: 0 },
        ],
        closed: false,
      }).points,
    ).toHaveLength(2);
  });
  it('offsets an orthogonal polyline with a miter', () => {
    const result = offsetPolyline(
      {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
        closed: false,
      },
      1,
    );
    expect(result).toMatchObject({
      kind: 'OK',
      polyline: {
        points: [
          { x: 0, y: 1 },
          { x: 9, y: 1 },
          { x: 9, y: 10 },
        ],
      },
    });
  });
  it('returns a diagnostic for a degenerate input', () => {
    expect(
      offsetPolyline({ points: [{ x: 0, y: 0 }], closed: false }, 10).kind,
    ).toBe('DEGENERATE');
  });
});
