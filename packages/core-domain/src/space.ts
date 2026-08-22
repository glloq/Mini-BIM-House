import {
  DEFAULT_GEOMETRY_TOLERANCE,
  intersectSegments,
  signedArea,
  validatePolygon,
  type Point2D,
  type Polygon2D,
  type Segment2D,
} from '@house-technical-designer/geometry';
import type { LevelId, SpaceId } from './ids.js';
import type { Wall } from './wall.js';

interface SpaceBase {
  readonly id: SpaceId;
  readonly type: 'SPACE';
  readonly levelId: LevelId;
  readonly name: string;
  readonly category: string;
  readonly usageProfileId?: string;
  readonly thermalZoneId?: string;
}

export type Space = SpaceBase &
  (
    | {
        readonly boundaryMode: 'AUTO';
        /**
         * A point inside the enclosure this room stands for.
         *
         * A room drawn by the walls around it is still a decision about which
         * enclosure it is, and the walls alone cannot say: a storey of six
         * rooms detects six faces and nothing pairs them. The anchor is that
         * pairing, and it is the only thing an automatic room carries — the
         * outline itself is derived and never stored.
         *
         * Optional so a file written before it reads: such a room has no
         * geometry anybody can resolve, and the application says so rather
         * than picking a face for it.
         */
        readonly anchor?: Point2D;
      }
    | { readonly boundaryMode: 'MANUAL'; readonly manualPolygon: Polygon2D }
  );

export interface DetectedSpaceBoundary {
  readonly polygon: Polygon2D;
  readonly sourceWallIds: readonly Wall['id'][];
}

export type SpaceDetectionResult =
  | {
      readonly status: 'OK';
      readonly boundaries: readonly DetectedSpaceBoundary[];
    }
  | {
      readonly status: 'INVALID';
      readonly reason: 'NO_WALLS' | 'NON_LINEAR_WALL' | 'NO_CLOSED_FACES';
    };

interface SourceSegment extends Segment2D {
  readonly wallId: Wall['id'];
}

interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly wallId: Wall['id'];
}

/** Derives planar faces from wall reference paths; detected polygons are never persisted as source data. */
export function detectSpaceBoundaries(
  walls: readonly Wall[],
): SpaceDetectionResult {
  if (walls.length === 0) return { status: 'INVALID', reason: 'NO_WALLS' };
  const segments: SourceSegment[] = [];
  for (const wall of walls) {
    for (let index = 1; index < wall.path.points.length; index += 1) {
      const start = wall.path.points[index - 1]!;
      const end = wall.path.points[index]!;
      if (
        Math.hypot(end.x - start.x, end.y - start.y) <=
        DEFAULT_GEOMETRY_TOLERANCE.pointMergeMm
      ) {
        return { status: 'INVALID', reason: 'NON_LINEAR_WALL' };
      }
      segments.push({ start, end, wallId: wall.id });
    }
  }

  const splitParameters = segments.map(() => new Set([0, 1]));
  for (let first = 0; first < segments.length; first += 1) {
    for (let second = first + 1; second < segments.length; second += 1) {
      const intersection = intersectSegments(
        segments[first]!,
        segments[second]!,
      );
      if (intersection.kind === 'POINT') {
        splitParameters[first]!.add(
          clampParameter(intersection.firstParameter),
        );
        splitParameters[second]!.add(
          clampParameter(intersection.secondParameter),
        );
      }
    }
  }

  const points = new Map<string, Point2D>();
  const edges: GraphEdge[] = [];
  segments.forEach((segment, index) => {
    const parameters = [...splitParameters[index]!].sort((a, b) => a - b);
    for (let part = 1; part < parameters.length; part += 1) {
      const fromPoint = interpolate(segment, parameters[part - 1]!);
      const toPoint = interpolate(segment, parameters[part]!);
      const from = pointKey(fromPoint);
      const to = pointKey(toPoint);
      if (from === to) continue;
      points.set(from, fromPoint);
      points.set(to, toPoint);
      edges.push(
        { from, to, wallId: segment.wallId },
        { from: to, to: from, wallId: segment.wallId },
      );
    }
  });

  const outgoing = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge);
    outgoing.set(edge.from, list);
  }
  for (const [key, list] of outgoing) {
    const origin = points.get(key)!;
    list.sort(
      (a, b) =>
        angle(origin, points.get(a.to)!) - angle(origin, points.get(b.to)!),
    );
  }

  const visited = new Set<string>();
  const boundaries: DetectedSpaceBoundary[] = [];
  for (const start of edges) {
    const startKey = directedKey(start);
    if (visited.has(startKey)) continue;
    const cycle: Point2D[] = [];
    const wallIds = new Set<Wall['id']>();
    let current = start;
    let closed = false;
    for (let guard = 0; guard <= edges.length; guard += 1) {
      const key = directedKey(current);
      if (visited.has(key)) {
        closed = key === startKey;
        break;
      }
      visited.add(key);
      cycle.push(points.get(current.from)!);
      wallIds.add(current.wallId);
      const candidates = outgoing.get(current.to) ?? [];
      const reverseIndex = candidates.findIndex(
        (candidate) => candidate.to === current.from,
      );
      if (reverseIndex < 0 || candidates.length < 2) break;
      current =
        candidates[(reverseIndex - 1 + candidates.length) % candidates.length]!;
    }
    if (
      !closed ||
      cycle.length < 3 ||
      signedArea(cycle) <= DEFAULT_GEOMETRY_TOLERANCE.areaMm2
    )
      continue;
    const polygon: Polygon2D = { outer: cycle };
    if (validatePolygon(polygon).length === 0)
      boundaries.push({ polygon, sourceWallIds: [...wallIds] });
  }
  return boundaries.length > 0
    ? { status: 'OK', boundaries }
    : { status: 'INVALID', reason: 'NO_CLOSED_FACES' };
}

export function validateSpace(space: Space): readonly string[] {
  if (space.name.trim() === '') return ['name must not be empty'];
  if (space.boundaryMode === 'MANUAL')
    return validatePolygon(space.manualPolygon).map(({ message }) => message);
  if (
    space.anchor !== undefined &&
    (!Number.isFinite(space.anchor.x) || !Number.isFinite(space.anchor.y))
  )
    return ['anchor must be a finite point'];
  return [];
}

function clampParameter(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function interpolate(segment: Segment2D, parameter: number): Point2D {
  return {
    x: segment.start.x + (segment.end.x - segment.start.x) * parameter,
    y: segment.start.y + (segment.end.y - segment.start.y) * parameter,
  };
}

function pointKey(point: Point2D): string {
  const tolerance = DEFAULT_GEOMETRY_TOLERANCE.pointMergeMm;
  return `${Math.round(point.x / tolerance)},${Math.round(point.y / tolerance)}`;
}

function directedKey(edge: GraphEdge): string {
  return `${edge.from}>${edge.to}`;
}

function angle(origin: Point2D, target: Point2D): number {
  return Math.atan2(target.y - origin.y, target.x - origin.x);
}
