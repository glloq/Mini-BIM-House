import { describe, expect, it } from 'vitest';
import { carriedGeometry } from './ghost-geometry.js';

const delta = { x: 100, y: -50 };

describe('the shape a dragged object would have once dropped', () => {
  it('carries the holes of an outline with it', () => {
    // A stairwell left behind by the ghost and carried by the edit would be a
    // drawing nobody can trust.
    const moved = carriedGeometry(
      {
        kind: 'POLYGON',
        polygon: {
          outer: [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
            { x: 1000, y: 1000 },
          ],
          holes: [
            [
              { x: 200, y: 200 },
              { x: 400, y: 200 },
              { x: 400, y: 400 },
            ],
          ],
        },
      },
      delta,
    );
    expect(moved.kind).toBe('POLYGON');
    if (moved.kind !== 'POLYGON') return;
    expect(moved.polygon.outer[0]).toEqual({ x: 100, y: -50 });
    expect(moved.polygon.holes?.[0]?.[0]).toEqual({ x: 300, y: 150 });
    // Every ring travels the same distance, or the hole would move inside its
    // own outline.
    expect(moved.polygon.holes?.[0]?.[2]).toEqual({ x: 500, y: 350 });
  });

  it('leaves an outline without holes without one', () => {
    const moved = carriedGeometry(
      { kind: 'POLYGON', polygon: { outer: [{ x: 0, y: 0 }] } },
      delta,
    );
    if (moved.kind !== 'POLYGON') return;
    expect(moved.polygon.holes).toBeUndefined();
  });

  it('carries the other kinds of geometry as well', () => {
    const line = carriedGeometry(
      {
        kind: 'POLYLINE',
        polyline: {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
          ],
          closed: false,
        },
      },
      delta,
    );
    if (line.kind !== 'POLYLINE') return;
    expect(line.polyline.points[1]).toEqual({ x: 110, y: -40 });

    const label = carriedGeometry(
      { kind: 'TEXT', anchor: { x: 5, y: 5 }, text: 'Séjour' },
      delta,
    );
    if (label.kind !== 'TEXT') return;
    expect(label.anchor).toEqual({ x: 105, y: -45 });

    const dot = carriedGeometry(
      { kind: 'POINT', point: { x: 1, y: 2 } },
      delta,
    );
    if (dot.kind !== 'POINT') return;
    expect(dot.point).toEqual({ x: 101, y: -48 });
  });
});
