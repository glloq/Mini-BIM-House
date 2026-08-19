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
  const degenerateHole = (polygon.holes ?? []).findIndex(
    (ring) => Math.abs(signedRingArea(ring)) <= tolerance.areaMm2,
  );
  if (degenerateHole >= 0)
    return [
      {
        code: 'DEGENERATE_POLYGON',
        message: `Polygon hole ${degenerateHole} has no area.`,
      },
    ];
  if (rings.some((ring) => ringSelfIntersects(ring, tolerance.collinearMm))) {
    return [
      { code: 'SELF_INTERSECTION', message: 'Polygon rings must be simple.' },
    ];
  }
  for (const [holeIndex, hole] of (polygon.holes ?? []).entries()) {
    if (ringsIntersect(polygon.outer, hole, tolerance.collinearMm))
      return [
        {
          code: 'RING_INTERSECTION',
          message: `Polygon hole ${holeIndex} crosses or touches the outer boundary.`,
        },
      ];
    if (!pointInRing(hole[0]!, polygon.outer, tolerance.collinearMm))
      return [
        {
          code: 'HOLE_OUTSIDE_OUTER',
          message: `Polygon hole ${holeIndex} must be strictly inside the outer ring.`,
        },
      ];
    for (let otherIndex = 0; otherIndex < holeIndex; otherIndex += 1) {
      const other = polygon.holes![otherIndex]!;
      if (
        ringsIntersect(hole, other, tolerance.collinearMm) ||
        pointInRing(hole[0]!, other, tolerance.collinearMm) ||
        pointInRing(other[0]!, hole, tolerance.collinearMm)
      )
        return [
          {
            code: 'HOLE_OVERLAP',
            message: `Polygon holes ${otherIndex} and ${holeIndex} overlap, touch, or contain one another.`,
          },
        ];
    }
  }
  return [];
}

function ringsIntersect(
  first: readonly Point2D[],
  second: readonly Point2D[],
  epsilon: number,
): boolean {
  return first.some((start, firstIndex) => {
    const end = first[(firstIndex + 1) % first.length]!;
    return second.some((otherStart, secondIndex) =>
      segmentsMeet(
        start,
        end,
        otherStart,
        second[(secondIndex + 1) % second.length]!,
        epsilon,
      ),
    );
  });
}

function segmentsMeet(
  a: Point2D,
  b: Point2D,
  c: Point2D,
  d: Point2D,
  epsilon: number,
): boolean {
  const abc = orientation(a, b, c);
  const abd = orientation(a, b, d);
  const cda = orientation(c, d, a);
  const cdb = orientation(c, d, b);
  if (abc * abd < -epsilon && cda * cdb < -epsilon) return true;
  return (
    (Math.abs(abc) <= epsilon && onSegment(c, a, b, epsilon)) ||
    (Math.abs(abd) <= epsilon && onSegment(d, a, b, epsilon)) ||
    (Math.abs(cda) <= epsilon && onSegment(a, c, d, epsilon)) ||
    (Math.abs(cdb) <= epsilon && onSegment(b, c, d, epsilon))
  );
}

function pointInRing(
  point: Point2D,
  ring: readonly Point2D[],
  epsilon: number,
): boolean {
  let inside = false;
  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index]!;
    const end = ring[(index + 1) % ring.length]!;
    if (
      Math.abs(orientation(start, end, point)) <= epsilon &&
      onSegment(point, start, end, epsilon)
    )
      return false;
    if (
      start.y > point.y !== end.y > point.y &&
      point.x <
        ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x
    )
      inside = !inside;
  }
  return inside;
}

function orientation(a: Point2D, b: Point2D, c: Point2D): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(
  point: Point2D,
  start: Point2D,
  end: Point2D,
  epsilon: number,
): boolean {
  return (
    point.x >= Math.min(start.x, end.x) - epsilon &&
    point.x <= Math.max(start.x, end.x) + epsilon &&
    point.y >= Math.min(start.y, end.y) - epsilon &&
    point.y <= Math.max(start.y, end.y) + epsilon
  );
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
