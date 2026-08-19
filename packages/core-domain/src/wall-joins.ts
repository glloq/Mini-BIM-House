import {
  intersectSegments,
  type Point2D,
  type Segment2D,
} from '@house-technical-designer/geometry';
import type { Wall } from './wall.js';

export type WallJoinPolicy = 'AUTO' | 'MITER' | 'BUTT' | 'DISALLOW';
export type WallJoinKind = 'L' | 'T' | 'X' | 'COLLINEAR' | 'NONE';
export type WallEndpoint = 'START' | 'END' | 'INTERIOR';

export interface WallJoinParticipant {
  readonly wallId: Wall['id'];
  readonly location: WallEndpoint;
}

export type WallJoinResult =
  | {
      readonly status: 'JOINED';
      readonly kind: Exclude<WallJoinKind, 'NONE'>;
      readonly point: Point2D;
      readonly participants: readonly [
        WallJoinParticipant,
        WallJoinParticipant,
      ];
      readonly policy: Exclude<WallJoinPolicy, 'DISALLOW'>;
    }
  | {
      readonly status: 'NO_JOIN';
      readonly kind: 'NONE';
      readonly reason:
        'NO_INTERSECTION' | 'POLICY_DISALLOWS' | 'OVERLAPPING_COLLINEAR';
    }
  | {
      readonly status: 'INVALID';
      readonly reason: 'NON_STRAIGHT_WALL' | 'DEGENERATE_WALL';
    };

/**
 * Resolves the topology of two straight wall reference paths. Face trimming is
 * deliberately kept separate: topology is explicit and must not be inferred
 * later from coincident rendered polygons.
 */
export function resolveStraightWallJoin(
  first: Wall,
  second: Wall,
  policy: WallJoinPolicy = 'AUTO',
  endpointTolerance = 1e-7,
): WallJoinResult {
  const firstSegment = wallSegment(first);
  const secondSegment = wallSegment(second);
  if (firstSegment === undefined || secondSegment === undefined) {
    return { status: 'INVALID', reason: 'NON_STRAIGHT_WALL' };
  }
  const intersection = intersectSegments(firstSegment, secondSegment);
  if (intersection.kind === 'DEGENERATE')
    return { status: 'INVALID', reason: 'DEGENERATE_WALL' };
  if (intersection.kind === 'NONE')
    return { status: 'NO_JOIN', kind: 'NONE', reason: 'NO_INTERSECTION' };
  if (intersection.kind === 'OVERLAP') {
    return { status: 'NO_JOIN', kind: 'NONE', reason: 'OVERLAPPING_COLLINEAR' };
  }
  if (policy === 'DISALLOW')
    return { status: 'NO_JOIN', kind: 'NONE', reason: 'POLICY_DISALLOWS' };

  const firstLocation = parameterLocation(
    intersection.firstParameter,
    endpointTolerance,
  );
  const secondLocation = parameterLocation(
    intersection.secondParameter,
    endpointTolerance,
  );
  const kind = classifyJoin(
    firstSegment,
    secondSegment,
    firstLocation,
    secondLocation,
  );
  return {
    status: 'JOINED',
    kind,
    point: intersection.point,
    participants: [
      { wallId: first.id, location: firstLocation },
      { wallId: second.id, location: secondLocation },
    ],
    policy: policy === 'AUTO' ? automaticPolicy(kind) : policy,
  };
}

function wallSegment(wall: Wall): Segment2D | undefined {
  return wall.path.points.length === 2
    ? { start: wall.path.points[0]!, end: wall.path.points[1]! }
    : undefined;
}

function parameterLocation(parameter: number, tolerance: number): WallEndpoint {
  if (Math.abs(parameter) <= tolerance) return 'START';
  if (Math.abs(parameter - 1) <= tolerance) return 'END';
  return 'INTERIOR';
}

function classifyJoin(
  first: Segment2D,
  second: Segment2D,
  firstLocation: WallEndpoint,
  secondLocation: WallEndpoint,
): Exclude<WallJoinKind, 'NONE'> {
  const firstVector = {
    x: first.end.x - first.start.x,
    y: first.end.y - first.start.y,
  };
  const secondVector = {
    x: second.end.x - second.start.x,
    y: second.end.y - second.start.y,
  };
  const cross = firstVector.x * secondVector.y - firstVector.y * secondVector.x;
  const scale =
    Math.hypot(firstVector.x, firstVector.y) *
    Math.hypot(secondVector.x, secondVector.y);
  if (Math.abs(cross) <= 1e-9 * scale) return 'COLLINEAR';
  if (firstLocation === 'INTERIOR' && secondLocation === 'INTERIOR') return 'X';
  if (firstLocation === 'INTERIOR' || secondLocation === 'INTERIOR') return 'T';
  return 'L';
}

function automaticPolicy(
  kind: Exclude<WallJoinKind, 'NONE'>,
): 'MITER' | 'BUTT' {
  return kind === 'L' ? 'MITER' : 'BUTT';
}
