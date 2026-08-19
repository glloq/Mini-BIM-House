import { DEFAULT_GEOMETRY_TOLERANCE } from './tolerance.js';
import type {
  GeometryTolerance,
  OffsetResult,
  Point2D,
  Polyline2D,
  Segment2D,
  SegmentIntersection,
} from './types.js';

const cross = (a: Point2D, b: Point2D): number => a.x * b.y - a.y * b.x;
const subtract = (a: Point2D, b: Point2D): Point2D => ({
  x: a.x - b.x,
  y: a.y - b.y,
});
const interpolate = (segment: Segment2D, t: number): Point2D => ({
  x: segment.start.x + (segment.end.x - segment.start.x) * t,
  y: segment.start.y + (segment.end.y - segment.start.y) * t,
});

export function intersectSegments(
  first: Segment2D,
  second: Segment2D,
  tolerance: GeometryTolerance = DEFAULT_GEOMETRY_TOLERANCE,
): SegmentIntersection {
  const r = subtract(first.end, first.start);
  const s = subtract(second.end, second.start);
  const rLengthSquared = r.x * r.x + r.y * r.y;
  const sLengthSquared = s.x * s.x + s.y * s.y;
  const epsilonSquared = tolerance.pointMergeMm ** 2;
  if (rLengthSquared <= epsilonSquared || sLengthSquared <= epsilonSquared) {
    return {
      kind: 'DEGENERATE',
      segment:
        rLengthSquared <= epsilonSquared && sLengthSquared <= epsilonSquared
          ? 'BOTH'
          : rLengthSquared <= epsilonSquared
            ? 'FIRST'
            : 'SECOND',
    };
  }

  const originDelta = subtract(second.start, first.start);
  const denominator = cross(r, s);
  const scaledTolerance =
    tolerance.angularRad * Math.sqrt(rLengthSquared * sLengthSquared);
  if (Math.abs(denominator) <= scaledTolerance) {
    if (
      Math.abs(cross(originDelta, r)) >
      tolerance.collinearMm * Math.sqrt(rLengthSquared)
    )
      return { kind: 'NONE' };
    const t0 = (originDelta.x * r.x + originDelta.y * r.y) / rLengthSquared;
    const t1 = t0 + (s.x * r.x + s.y * r.y) / rLengthSquared;
    const start = Math.max(0, Math.min(t0, t1));
    const end = Math.min(1, Math.max(t0, t1));
    const parameterTolerance =
      tolerance.pointMergeMm / Math.sqrt(rLengthSquared);
    if (end < start - parameterTolerance) return { kind: 'NONE' };
    if (Math.abs(end - start) <= parameterTolerance) {
      const point = interpolate(
        first,
        Math.max(0, Math.min(1, (start + end) / 2)),
      );
      const u =
        ((point.x - second.start.x) * s.x) / sLengthSquared +
        ((point.y - second.start.y) * s.y) / sLengthSquared;
      return {
        kind: 'POINT',
        point,
        firstParameter: start,
        secondParameter: u,
      };
    }
    return {
      kind: 'OVERLAP',
      segment: {
        start: interpolate(first, start),
        end: interpolate(first, end),
      },
    };
  }

  const t = cross(originDelta, s) / denominator;
  const u = cross(originDelta, r) / denominator;
  if (
    t < -tolerance.pointMergeMm ||
    t > 1 + tolerance.pointMergeMm ||
    u < -tolerance.pointMergeMm ||
    u > 1 + tolerance.pointMergeMm
  )
    return { kind: 'NONE' };
  const boundedT = Math.max(0, Math.min(1, t));
  return {
    kind: 'POINT',
    point: interpolate(first, boundedT),
    firstParameter: boundedT,
    secondParameter: Math.max(0, Math.min(1, u)),
  };
}

export function normalizePolyline(
  polyline: Polyline2D,
  tolerance: GeometryTolerance = DEFAULT_GEOMETRY_TOLERANCE,
): Polyline2D {
  const points: Point2D[] = [];
  for (const point of polyline.points) {
    const previous = points.at(-1);
    if (
      previous === undefined ||
      Math.hypot(point.x - previous.x, point.y - previous.y) >
        tolerance.pointMergeMm
    )
      points.push(point);
  }
  if (polyline.closed && points.length > 1) {
    const first = points[0]!;
    const last = points.at(-1)!;
    if (
      Math.hypot(first.x - last.x, first.y - last.y) <= tolerance.pointMergeMm
    )
      points.pop();
  }
  return { points, closed: polyline.closed };
}

export function offsetPolyline(
  polyline: Polyline2D,
  distanceMm: number,
  tolerance: GeometryTolerance = DEFAULT_GEOMETRY_TOLERANCE,
): OffsetResult {
  if (!Number.isFinite(distanceMm))
    return { kind: 'DEGENERATE', message: 'Offset distance must be finite.' };
  const normalized = normalizePolyline(polyline, tolerance);
  if (normalized.closed)
    return {
      kind: 'DEGENERATE',
      message: 'Closed polygon offsets are not supported by the simple offset.',
    };
  if (normalized.points.length < 2)
    return {
      kind: 'DEGENERATE',
      message: 'Offset requires at least two distinct points.',
    };
  const offsetSegments: Segment2D[] = [];
  for (let index = 1; index < normalized.points.length; index += 1) {
    const start = normalized.points[index - 1]!;
    const end = normalized.points[index]!;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length <= tolerance.pointMergeMm) continue;
    const normal = {
      x: (-(end.y - start.y) / length) * distanceMm,
      y: ((end.x - start.x) / length) * distanceMm,
    };
    offsetSegments.push({
      start: { x: start.x + normal.x, y: start.y + normal.y },
      end: { x: end.x + normal.x, y: end.y + normal.y },
    });
  }
  if (offsetSegments.length === 0)
    return { kind: 'DEGENERATE', message: 'Offset contains no valid segment.' };
  const points: Point2D[] = [offsetSegments[0]!.start];
  for (let index = 1; index < offsetSegments.length; index += 1) {
    const previous = offsetSegments[index - 1]!;
    const current = offsetSegments[index]!;
    const intersection = intersectInfiniteLines(previous, current, tolerance);
    points.push(
      intersection ?? previous.end,
      ...(intersection === undefined ? [current.start] : []),
    );
  }
  points.push(offsetSegments.at(-1)!.end);
  return { kind: 'OK', polyline: { points, closed: false } };
}

function intersectInfiniteLines(
  first: Segment2D,
  second: Segment2D,
  tolerance: GeometryTolerance,
): Point2D | undefined {
  const r = subtract(first.end, first.start);
  const s = subtract(second.end, second.start);
  const denominator = cross(r, s);
  if (
    Math.abs(denominator) <=
    tolerance.angularRad * Math.hypot(r.x, r.y) * Math.hypot(s.x, s.y)
  )
    return undefined;
  return interpolate(
    first,
    cross(subtract(second.start, first.start), s) / denominator,
  );
}
