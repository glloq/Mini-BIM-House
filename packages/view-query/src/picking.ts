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

/** How a rubber band decides what it caught. */
export type BoxSelectionMode =
  /** Only what lies entirely inside the band, as dragging rightwards means. */
  | 'WINDOW'
  /** Everything the band touches, as dragging leftwards means. */
  | 'CROSSING';

export interface SelectionBox {
  readonly min: Point2D;
  readonly max: Point2D;
}

/** The band a drag between two points describes, and what it means. */
export function selectionBoxOf(
  from: Point2D,
  to: Point2D,
): { readonly box: SelectionBox; readonly mode: BoxSelectionMode } {
  return {
    box: {
      min: { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y) },
      max: { x: Math.max(from.x, to.x), y: Math.max(from.y, to.y) },
    },
    // Dragging rightwards takes what is wholly inside; dragging leftwards takes
    // whatever is touched. It is the convention every drawing tool shares, and
    // it is the difference between selecting a room and selecting the walls
    // that pass through it.
    mode: to.x >= from.x ? 'WINDOW' : 'CROSSING',
  };
}

function pointsOf(primitive: ScenePrimitive): readonly Point2D[] {
  const { geometry } = primitive;
  if (geometry.kind === 'POINT') return [geometry.point];
  if (geometry.kind === 'TEXT') return [geometry.anchor];
  if (geometry.kind === 'POLYLINE') return geometry.polyline.points;
  return geometry.polygon.outer;
}

function inside(box: SelectionBox, point: Point2D): boolean {
  return (
    point.x >= box.min.x &&
    point.x <= box.max.x &&
    point.y >= box.min.y &&
    point.y <= box.max.y
  );
}

function segmentsCross(
  first: readonly [Point2D, Point2D],
  second: readonly [Point2D, Point2D],
): boolean {
  const side = (a: Point2D, b: Point2D, c: Point2D): number =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const [p1, p2] = first;
  const [p3, p4] = second;
  const d1 = side(p3, p4, p1);
  const d2 = side(p3, p4, p2);
  const d3 = side(p1, p2, p3);
  const d4 = side(p1, p2, p4);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

function edgesOf(
  points: readonly Point2D[],
  closed: boolean,
): readonly (readonly [Point2D, Point2D])[] {
  const edges: (readonly [Point2D, Point2D])[] = [];
  for (let index = 1; index < points.length; index += 1)
    edges.push([points[index - 1]!, points[index]!]);
  if (closed && points.length > 2)
    edges.push([points[points.length - 1]!, points[0]!]);
  return edges;
}

function boxEdges(box: SelectionBox): readonly (readonly [Point2D, Point2D])[] {
  const corners: readonly Point2D[] = [
    box.min,
    { x: box.max.x, y: box.min.y },
    box.max,
    { x: box.min.x, y: box.max.y },
  ];
  return edgesOf(corners, true);
}

/**
 * The objects a rubber band selects.
 *
 * Selecting one object at a time is enough to draw a room and not enough to
 * change the assembly of every wall of a storey. A band answers that: it is the
 * gesture the user already knows from every other drawing tool, and the two
 * directions mean two different questions.
 */
export function objectsInBox(
  primitives: readonly ScenePrimitive[],
  box: SelectionBox,
  mode: BoxSelectionMode,
): readonly string[] {
  const selected = new Set<string>();
  const refused = new Set<string>();
  for (const primitive of primitives) {
    const objectId = primitive.sourceObjectId;
    if (objectId === undefined) continue;
    const points = pointsOf(primitive);
    if (points.length === 0) continue;
    const closed = primitive.geometry.kind === 'POLYGON';
    const caught =
      mode === 'WINDOW'
        ? points.every((point) => inside(box, point))
        : points.some((point) => inside(box, point)) ||
          edgesOf(points, closed).some((edge) =>
            boxEdges(box).some((side) => segmentsCross(edge, side)),
          ) ||
          // A band drawn wholly inside a filled shape touches it, even though
          // no outline of either crosses the other.
          (primitive.geometry.kind === 'POLYGON' &&
            pointInPolygon(primitive.geometry.polygon, box.min));
    // An object is drawn by several primitives — a wall has its cut and its
    // outline. Under a window band all of them have to fit, or half a wall
    // would be reported as a whole one.
    if (caught) selected.add(objectId);
    else refused.add(objectId);
  }
  const kept = [...selected].filter(
    (objectId) => mode === 'CROSSING' || !refused.has(objectId),
  );
  return kept;
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
