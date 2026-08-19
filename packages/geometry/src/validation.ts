import { DEFAULT_GEOMETRY_TOLERANCE } from './tolerance.js';
import type {
  GeometryIssue,
  GeometryTolerance,
  Point2D,
  Point3D,
  Polygon2D,
  Polyline2D,
  Segment2D,
} from './types.js';

export function isFinitePoint2D(point: Point2D): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function isFinitePoint3D(point: Point3D): boolean {
  return isFinitePoint2D(point) && Number.isFinite(point.z);
}

export function validateSegment(
  segment: Segment2D,
  tolerance: GeometryTolerance = DEFAULT_GEOMETRY_TOLERANCE,
): readonly GeometryIssue[] {
  if (!isFinitePoint2D(segment.start) || !isFinitePoint2D(segment.end)) {
    return [
      {
        code: 'NON_FINITE_COORDINATE',
        message: 'Segment coordinates must be finite.',
      },
    ];
  }
  if (distance(segment.start, segment.end) <= tolerance.pointMergeMm) {
    return [
      {
        code: 'DEGENERATE_SEGMENT',
        message: 'Segment endpoints are coincident.',
      },
    ];
  }
  return [];
}

export function validatePolyline(
  polyline: Polyline2D,
): readonly GeometryIssue[] {
  if (polyline.points.some((point) => !isFinitePoint2D(point))) {
    return [
      {
        code: 'NON_FINITE_COORDINATE',
        message: 'Polyline coordinates must be finite.',
      },
    ];
  }
  const minimum = polyline.closed ? 3 : 2;
  return polyline.points.length < minimum
    ? [
        {
          code: 'INSUFFICIENT_POINTS',
          message: `Polyline requires at least ${minimum} points.`,
        },
      ]
    : [];
}

export function validatePolygon(
  polygon: Polygon2D,
  tolerance: GeometryTolerance = DEFAULT_GEOMETRY_TOLERANCE,
): readonly GeometryIssue[] {
  const rings = [polygon.outer, ...(polygon.holes ?? [])];
  if (rings.some((ring) => ring.some((point) => !isFinitePoint2D(point)))) {
    return [
      {
        code: 'NON_FINITE_COORDINATE',
        message: 'Polygon coordinates must be finite.',
      },
    ];
  }
  if (rings.some((ring) => ring.length < 3)) {
    return [
      {
        code: 'INSUFFICIENT_POINTS',
        message: 'Every polygon ring requires at least 3 points.',
      },
    ];
  }
  if (Math.abs(signedRingArea(polygon.outer)) <= tolerance.areaMm2) {
    return [
      {
        code: 'DEGENERATE_POLYGON',
        message: 'Polygon outer ring has no area.',
      },
    ];
  }
  if (rings.some((ring) => ringSelfIntersects(ring, tolerance.collinearMm))) {
    return [
      { code: 'SELF_INTERSECTION', message: 'Polygon rings must be simple.' },
    ];
  }
  return [];
}

function ringSelfIntersects(
  points: readonly Point2D[],
  epsilon: number,
): boolean {
  for (let first = 0; first < points.length; first += 1) {
    const a = points[first];
    const b = points[(first + 1) % points.length];
    if (a === undefined || b === undefined) continue;
    for (let second = first + 1; second < points.length; second += 1) {
      // Adjacent edges share a legitimate vertex; first and last edges are adjacent too.
      if (second === first + 1 || (first === 0 && second === points.length - 1))
        continue;
      const c = points[second];
      const d = points[(second + 1) % points.length];
      if (
        c !== undefined &&
        d !== undefined &&
        properIntersection(a, b, c, d, epsilon)
      )
        return true;
    }
  }
  return false;
}

function properIntersection(
  a: Point2D,
  b: Point2D,
  c: Point2D,
  d: Point2D,
  epsilon: number,
): boolean {
  const orientation = (p: Point2D, q: Point2D, r: Point2D): number =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  return abC * abD < -epsilon && cdA * cdB < -epsilon;
}

function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function signedRingArea(points: readonly Point2D[]): number {
  let twiceArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (current !== undefined && next !== undefined) {
      twiceArea += current.x * next.y - next.x * current.y;
    }
  }
  return twiceArea / 2;
}
