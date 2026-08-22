import type {
  BoundingBox2D,
  BoundingBox3D,
  Point2D,
  Point3D,
  Polygon2D,
  Polyline2D,
  Segment2D,
} from './types.js';

export function distance2D(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function distance3D(a: Point3D, b: Point3D): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

export function segmentLength(segment: Segment2D): number {
  return distance2D(segment.start, segment.end);
}

export function polylineLength(polyline: Polyline2D): number {
  let length = 0;
  for (let index = 1; index < polyline.points.length; index += 1) {
    const previous = polyline.points[index - 1];
    const current = polyline.points[index];
    if (previous !== undefined && current !== undefined)
      length += distance2D(previous, current);
  }
  const first = polyline.points[0];
  const last = polyline.points.at(-1);
  if (polyline.closed && first !== undefined && last !== undefined)
    length += distance2D(last, first);
  return length;
}

/** Signed ring area: positive for counter-clockwise rings. */
export function signedArea(points: readonly Point2D[]): number {
  let twiceArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (current !== undefined && next !== undefined)
      twiceArea += current.x * next.y - next.x * current.y;
  }
  return twiceArea / 2;
}

/** Area in mm². Hole orientation does not affect the result. */
export function polygonArea(polygon: Polygon2D): number {
  const holesArea = (polygon.holes ?? []).reduce(
    (sum, hole) => sum + Math.abs(signedArea(hole)),
    0,
  );
  return Math.max(0, Math.abs(signedArea(polygon.outer)) - holesArea);
}

/** Perimeter of a closed ring, in mm. The ring is not repeated at the end. */
export function ringPerimeter(points: readonly Point2D[]): number {
  let total = 0;
  for (const [index, current] of points.entries()) {
    const next = points[(index + 1) % points.length]!;
    total += Math.hypot(next.x - current.x, next.y - current.y);
  }
  return total;
}

/** Perimeter in mm, holes included: a room's skirting runs round them too. */
export function polygonPerimeter(polygon: Polygon2D): number {
  return (
    ringPerimeter(polygon.outer) +
    (polygon.holes ?? []).reduce((sum, hole) => sum + ringPerimeter(hole), 0)
  );
}

/**
 * Whether a point is inside a polygon, holes counting as outside.
 *
 * The even-odd rule, walked as a ray to the east. A point exactly on an edge
 * is on the boundary and this says nothing useful about it — which is why the
 * only caller that matters passes a point somebody placed inside a room.
 */
export function polygonContains(polygon: Polygon2D, point: Point2D): boolean {
  if (!ringContains(polygon.outer, point)) return false;
  return !(polygon.holes ?? []).some((hole) => ringContains(hole, point));
}

function ringContains(points: readonly Point2D[], point: Point2D): boolean {
  let inside = false;
  for (
    let index = 0, previous = points.length - 1;
    index < points.length;
    previous = index, index += 1
  ) {
    const current = points[index]!;
    const last = points[previous]!;
    if (current.y > point.y === last.y > point.y) continue;
    const crossingX =
      ((last.x - current.x) * (point.y - current.y)) / (last.y - current.y) +
      current.x;
    if (point.x < crossingX) inside = !inside;
  }
  return inside;
}

export function boundingBox2D(
  points: readonly Point2D[],
): BoundingBox2D | undefined {
  const first = points[0];
  if (first === undefined) return undefined;
  let minX = first.x;
  let minY = first.y;
  let maxX = first.x;
  let maxY = first.y;
  for (const point of points.slice(1)) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

export function boundingBox3D(
  points: readonly Point3D[],
): BoundingBox3D | undefined {
  const first = points[0];
  if (first === undefined) return undefined;
  let minX = first.x;
  let minY = first.y;
  let minZ = first.z;
  let maxX = first.x;
  let maxY = first.y;
  let maxZ = first.z;
  for (const point of points.slice(1)) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    minZ = Math.min(minZ, point.z);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
    maxZ = Math.max(maxZ, point.z);
  }
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}
