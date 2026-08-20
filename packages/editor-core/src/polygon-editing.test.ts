import { describe, expect, it } from 'vitest';
import {
  edgeMidpoints,
  withInsertedVertex,
  withMovedVertex,
  withoutVertex,
} from './polygon-editing.js';

const square = {
  outer: [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 3000 },
    { x: 0, y: 3000 },
  ],
};

describe('reshaping a footprint', () => {
  it('moves one corner and leaves the others where they were', () => {
    const moved = withMovedVertex(square, 2, { x: 5000, y: 3500 });
    expect(moved.outer).toEqual([
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 5000, y: 3500 },
      { x: 0, y: 3000 },
    ]);
    expect(square.outer[2]).toEqual({ x: 4000, y: 3000 });
  });

  it('inserts a corner on the edge it was asked for', () => {
    const inserted = withInsertedVertex(square, 0, { x: 2000, y: 0 });
    expect(inserted.outer.map(({ x }) => x)).toEqual([0, 2000, 4000, 4000, 0]);
  });

  it('offers the middle of every edge, the last one closing the contour', () => {
    expect(edgeMidpoints(square).map(({ point }) => point)).toEqual([
      { x: 2000, y: 0 },
      { x: 4000, y: 1500 },
      { x: 2000, y: 3000 },
      { x: 0, y: 1500 },
    ]);
  });

  it('removes a corner while three remain', () => {
    const removed = withoutVertex(square, 1);
    expect(removed?.outer).toHaveLength(3);
  });

  it('refuses to remove the corner that would leave a line', () => {
    const triangle = { outer: square.outer.slice(0, 3) };
    expect(withoutVertex(triangle, 0)).toBeUndefined();
  });
});
