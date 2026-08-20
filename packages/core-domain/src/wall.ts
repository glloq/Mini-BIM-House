import type {
  Assembly,
  AssemblyId,
} from '@house-technical-designer/assemblies';
import { totalThicknessMillimetres } from '@house-technical-designer/assemblies';
import { numericValue } from '@house-technical-designer/units';
import {
  offsetPolyline,
  validateSegment,
  validatePolyline,
  type Point2D,
  type Polygon2D,
  type Polyline2D,
} from '@house-technical-designer/geometry';
import type { LevelId, WallId } from './ids.js';

/**
 * Which face of the wall its drawn path represents.
 *
 * LEFT and RIGHT are relative to the direction the path is drawn in, not to
 * the inside and outside of the building: which side faces the interior is a
 * property of the enclosure, not of a single wall, so the model does not
 * pretend to know it here.
 *
 * The list is a runtime value and the type is derived from it, so a menu built
 * elsewhere can be checked against it instead of restating it from memory.
 */
export const WALL_REFERENCE_SIDES = ['CENTER', 'LEFT', 'RIGHT'] as const;
export type WallReferenceSide = (typeof WALL_REFERENCE_SIDES)[number];

export const WALL_ROLES = [
  'EXTERIOR',
  'INTERIOR',
  'PARTITION',
  'OTHER',
] as const;
export type WallRole = (typeof WALL_ROLES)[number];

export function isWallReferenceSide(value: string): value is WallReferenceSide {
  return (WALL_REFERENCE_SIDES as readonly string[]).includes(value);
}

export function isWallRole(value: string): value is WallRole {
  return (WALL_ROLES as readonly string[]).includes(value);
}

interface WallBase {
  readonly id: WallId;
  readonly type: 'WALL';
  readonly levelId: LevelId;
  readonly path: { readonly points: readonly Point2D[] };
  readonly referenceSide: WallReferenceSide;
  readonly assemblyId: AssemblyId;
  readonly baseOffsetMm: number;
  readonly role: WallRole;
}

export type Wall = WallBase &
  (
    | { readonly heightMode: 'EXPLICIT'; readonly heightMm: number }
    | {
        readonly heightMode: 'TO_LEVEL';
        readonly topLevelId: LevelId;
        readonly topOffsetMm?: number;
      }
  );

export type WallIssueCode =
  | 'INVALID_PATH'
  | 'INVALID_BASE_OFFSET'
  | 'INVALID_HEIGHT'
  | 'MISSING_ASSEMBLY'
  | 'INVALID_ASSEMBLY_CATEGORY'
  | 'INVALID_REFERENCE_SIDE'
  | 'INVALID_ROLE';

export interface WallIssue {
  readonly code: WallIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface WallFaces {
  readonly left: Polyline2D;
  readonly right: Polyline2D;
  readonly footprint: Polygon2D;
  readonly thicknessMm: number;
}

export function validateWall(
  wall: Wall,
  assembly?: Assembly,
): readonly WallIssue[] {
  const issues: WallIssue[] = validatePolyline({
    points: wall.path.points,
    closed: false,
  }).map(({ message }) => ({
    code: 'INVALID_PATH',
    path: 'path.points',
    message,
  }));
  for (let index = 1; index < wall.path.points.length; index += 1) {
    const segmentIssues = validateSegment({
      start: wall.path.points[index - 1]!,
      end: wall.path.points[index]!,
    });
    issues.push(
      ...segmentIssues.map(({ message }) => ({
        code: 'INVALID_PATH' as const,
        path: `path.points[${index - 1}:${index}]`,
        message,
      })),
    );
  }
  if (!isWallReferenceSide(wall.referenceSide))
    issues.push({
      code: 'INVALID_REFERENCE_SIDE',
      path: 'referenceSide',
      message: `must be one of ${WALL_REFERENCE_SIDES.join(', ')}`,
    });
  if (!isWallRole(wall.role))
    issues.push({
      code: 'INVALID_ROLE',
      path: 'role',
      message: `must be one of ${WALL_ROLES.join(', ')}`,
    });
  if (!Number.isFinite(wall.baseOffsetMm))
    issues.push({
      code: 'INVALID_BASE_OFFSET',
      path: 'baseOffsetMm',
      message: 'must be finite',
    });
  if (
    wall.heightMode === 'EXPLICIT' &&
    (!Number.isFinite(wall.heightMm) || wall.heightMm <= 0)
  ) {
    issues.push({
      code: 'INVALID_HEIGHT',
      path: 'heightMm',
      message: 'must be finite and greater than zero',
    });
  }
  if (assembly === undefined)
    issues.push({
      code: 'MISSING_ASSEMBLY',
      path: 'assemblyId',
      message: `unknown assembly ${wall.assemblyId}`,
    });
  else if (assembly.category !== 'WALL' && assembly.category !== 'PARTITION') {
    issues.push({
      code: 'INVALID_ASSEMBLY_CATEGORY',
      path: 'assemblyId',
      message: `assembly category ${assembly.category} cannot be used by a wall`,
    });
  }
  return issues;
}

/** Derives display geometry; the returned faces and footprint must never be persisted as source data. */
export function deriveWallFaces(wall: Wall, assembly: Assembly): WallFaces {
  const issues = validateWall(wall, assembly);
  if (issues.length > 0)
    throw new RangeError(
      issues.map(({ path, message }) => `${path}: ${message}`).join('; '),
    );
  const thicknessMm = numericValue(totalThicknessMillimetres(assembly));
  const [leftDistance, rightDistance] = faceOffsets(
    wall.referenceSide,
    thicknessMm,
  );
  const reference: Polyline2D = { points: wall.path.points, closed: false };
  const left = offsetPolyline(reference, leftDistance);
  const right = offsetPolyline(reference, rightDistance);
  if (left.kind !== 'OK' || right.kind !== 'OK')
    throw new RangeError(
      'Wall faces could not be derived from its reference path.',
    );
  return {
    left: left.polyline,
    right: right.polyline,
    footprint: {
      outer: [...left.polyline.points, ...[...right.polyline.points].reverse()],
    },
    thicknessMm,
  };
}

function faceOffsets(
  reference: WallReferenceSide,
  thicknessMm: number,
): readonly [number, number] {
  switch (reference) {
    case 'CENTER':
      return [thicknessMm / 2, -thicknessMm / 2];
    case 'LEFT':
      return [0, -thicknessMm];
    case 'RIGHT':
      return [thicknessMm, 0];
  }
}
