import type { Point2D, Polygon2D } from '@house-technical-designer/geometry';

/**
 * Reshaping a footprint, one vertex at a time.
 *
 * A slab or a roof is drawn from a contour and then corrected: a corner is
 * dragged, a corner is added where a wall was moved, a corner that no longer
 * means anything is removed. These produce the new polygon; whether it is a
 * polygon at all is the command's business, not theirs.
 */
export function withMovedVertex(
  polygon: Polygon2D,
  index: number,
  to: Point2D,
): Polygon2D {
  return {
    ...polygon,
    outer: polygon.outer.map((point, position) =>
      position === index ? { x: to.x, y: to.y } : point,
    ),
  };
}

/** The polygon with a vertex inserted after `edgeIndex`. */
export function withInsertedVertex(
  polygon: Polygon2D,
  edgeIndex: number,
  at: Point2D,
): Polygon2D {
  const outer = [...polygon.outer];
  outer.splice(edgeIndex + 1, 0, { x: at.x, y: at.y });
  return { ...polygon, outer };
}

/**
 * The polygon without one vertex, or nothing when it would stop being a surface.
 *
 * Three corners are the fewest a surface can have; removing one of three would
 * leave a line, and a line has no area to take a quantity from.
 */
export function withoutVertex(
  polygon: Polygon2D,
  index: number,
): Polygon2D | undefined {
  if (polygon.outer.length <= 3) return undefined;
  return {
    ...polygon,
    outer: polygon.outer.filter((_point, position) => position !== index),
  };
}

/** The middle of each edge, where a new vertex would be inserted. */
export function edgeMidpoints(
  polygon: Polygon2D,
): readonly { readonly edgeIndex: number; readonly point: Point2D }[] {
  return polygon.outer.map((point, index) => {
    const next = polygon.outer[(index + 1) % polygon.outer.length]!;
    return {
      edgeIndex: index,
      point: { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 },
    };
  });
}
