import type { ScenePrimitive } from '@house-technical-designer/drawing-engine';
import type { Point2D, Polygon2D } from '@house-technical-designer/geometry';

function pointInPolygon(polygon: Polygon2D, point: Point2D): boolean {
  const points = polygon.outer;
  let inside = false;
  for (
    let index = 0, previous = points.length - 1;
    index < points.length;
    previous = index, index += 1
  ) {
    const current = points[index]!;
    const last = points[previous]!;
    const straddles = current.y > point.y !== last.y > point.y;
    if (!straddles) continue;
    const crossingX =
      ((last.x - current.x) * (point.y - current.y)) / (last.y - current.y) +
      current.x;
    if (point.x < crossingX) inside = !inside;
  }
  return inside;
}

function distanceToSegment(
  point: Point2D,
  start: Point2D,
  end: Point2D,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0)
    return Math.hypot(point.x - start.x, point.y - start.y);
  const parameter = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (start.x + parameter * dx),
    point.y - (start.y + parameter * dy),
  );
}

/** Model-space distance from a point to a primitive, or undefined if outside it. */
export function distanceToPrimitive(
  primitive: ScenePrimitive,
  point: Point2D,
  toleranceMm: number,
): number | undefined {
  const { geometry } = primitive;
  if (geometry.kind === 'POINT') {
    const distance = Math.hypot(
      point.x - geometry.point.x,
      point.y - geometry.point.y,
    );
    return distance <= toleranceMm ? distance : undefined;
  }
  if (geometry.kind === 'TEXT') {
    const distance = Math.hypot(
      point.x - geometry.anchor.x,
      point.y - geometry.anchor.y,
    );
    return distance <= toleranceMm ? distance : undefined;
  }
  if (geometry.kind === 'POLYLINE') {
    const points = geometry.polyline.points;
    let best: number | undefined;
    for (let index = 1; index < points.length; index += 1) {
      const distance = distanceToSegment(
        point,
        points[index - 1]!,
        points[index]!,
      );
      if (distance <= toleranceMm && (best === undefined || distance < best))
        best = distance;
    }
    return best;
  }
  if (pointInPolygon(geometry.polygon, point)) return 0;
  const points = geometry.polygon.outer;
  let best: number | undefined;
  for (let index = 0; index < points.length; index += 1) {
    const distance = distanceToSegment(
      point,
      points[index]!,
      points[(index + 1) % points.length]!,
    );
    if (distance <= toleranceMm && (best === undefined || distance < best))
      best = distance;
  }
  return best;
}

export interface PickResult {
  readonly primitive: ScenePrimitive;
  readonly objectId: string;
  readonly distanceMm: number;
}

/**
 * Picks the object under a model point.
 *
 * Ties are broken by z-order so the topmost drawn object wins, which is what the
 * user sees and therefore what they expect to select.
 */
export function pickPrimitive(
  primitives: readonly ScenePrimitive[],
  point: Point2D,
  toleranceMm: number,
): PickResult | undefined {
  let best: PickResult | undefined;
  for (const primitive of primitives) {
    if (primitive.sourceObjectId === undefined) continue;
    const distanceMm = distanceToPrimitive(primitive, point, toleranceMm);
    if (distanceMm === undefined) continue;
    if (
      best === undefined ||
      primitive.zIndex > best.primitive.zIndex ||
      (primitive.zIndex === best.primitive.zIndex &&
        distanceMm < best.distanceMm)
    )
      best = { primitive, objectId: primitive.sourceObjectId, distanceMm };
  }
  return best;
}

/** Bounding box of the primitives belonging to a set of objects. */
export function boundsOfObjects(
  primitives: readonly ScenePrimitive[],
  objectIds: readonly string[],
): { readonly min: Point2D; readonly max: Point2D } | undefined {
  const wanted = new Set(objectIds);
  const points: Point2D[] = [];
  for (const primitive of primitives) {
    if (
      primitive.sourceObjectId === undefined ||
      !wanted.has(primitive.sourceObjectId)
    )
      continue;
    const { geometry } = primitive;
    if (geometry.kind === 'POINT') points.push(geometry.point);
    else if (geometry.kind === 'TEXT') points.push(geometry.anchor);
    else if (geometry.kind === 'POLYLINE')
      points.push(...geometry.polyline.points);
    else points.push(...geometry.polygon.outer);
  }
  if (points.length === 0) return undefined;
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  return {
    min: { x: Math.min(...xs), y: Math.min(...ys) },
    max: { x: Math.max(...xs), y: Math.max(...ys) },
  };
}
