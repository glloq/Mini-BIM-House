import { polylineLength } from '@house-technical-designer/geometry';
import type { OpeningId, WallId } from './ids.js';
import type { Wall } from './wall.js';

export const OPENING_TYPES = ['DOOR', 'WINDOW', 'VOID', 'OTHER'] as const;
export type OpeningType = (typeof OPENING_TYPES)[number];

export function isOpeningType(value: string): value is OpeningType {
  return (OPENING_TYPES as readonly string[]).includes(value);
}

export interface Opening {
  readonly id: OpeningId;
  readonly type: 'OPENING';
  readonly openingType: OpeningType;
  readonly hostElementId: WallId;
  /** Distance from the start of the host reference path to the opening start. */
  readonly offsetAlongHostMm: number;
  readonly sillHeightMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly definitionId?: string;
}

export type OpeningIssueCode =
  | 'WRONG_HOST'
  | 'INVALID_OFFSET'
  | 'INVALID_DIMENSION'
  | 'OUTSIDE_HOST'
  | 'OVERLAPPING_OPENINGS';

export interface OpeningIssue {
  readonly code: OpeningIssueCode;
  readonly path: string;
  readonly message: string;
}

export function validateOpening(
  opening: Opening,
  host: Wall,
): readonly OpeningIssue[] {
  const issues: OpeningIssue[] = [];
  if (opening.hostElementId !== host.id)
    issues.push({
      code: 'WRONG_HOST',
      path: 'hostElementId',
      message: 'does not reference the supplied wall',
    });
  if (
    !Number.isFinite(opening.offsetAlongHostMm) ||
    opening.offsetAlongHostMm < 0
  ) {
    issues.push({
      code: 'INVALID_OFFSET',
      path: 'offsetAlongHostMm',
      message: 'must be finite and non-negative',
    });
  }
  for (const [path, value] of [
    ['widthMm', opening.widthMm],
    ['heightMm', opening.heightMm],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0)
      issues.push({
        code: 'INVALID_DIMENSION',
        path,
        message: 'must be finite and greater than zero',
      });
  }
  if (!Number.isFinite(opening.sillHeightMm))
    issues.push({
      code: 'INVALID_DIMENSION',
      path: 'sillHeightMm',
      message: 'must be finite',
    });
  const hostLength = polylineLength({
    points: host.path.points,
    closed: false,
  });
  if (
    Number.isFinite(opening.offsetAlongHostMm) &&
    Number.isFinite(opening.widthMm) &&
    opening.offsetAlongHostMm + opening.widthMm > hostLength
  ) {
    issues.push({
      code: 'OUTSIDE_HOST',
      path: 'offsetAlongHostMm',
      message: 'opening extends beyond its host path',
    });
  }
  if (
    host.heightMode === 'EXPLICIT' &&
    Number.isFinite(opening.sillHeightMm) &&
    Number.isFinite(opening.heightMm) &&
    opening.sillHeightMm + opening.heightMm > host.heightMm
  ) {
    issues.push({
      code: 'OUTSIDE_HOST',
      path: 'sillHeightMm',
      message: 'opening extends above its host wall',
    });
  }
  return issues;
}

export type WallAreaResult =
  | {
      readonly status: 'OK';
      readonly grossAreaMm2: number;
      readonly openingAreaMm2: number;
      readonly netAreaMm2: number;
    }
  | {
      readonly status: 'UNKNOWN';
      readonly reason: 'WALL_HEIGHT_REQUIRES_LEVELS';
    }
  | { readonly status: 'INVALID'; readonly issues: readonly OpeningIssue[] };

export function calculateWallNetArea(
  wall: Wall,
  openings: readonly Opening[],
): WallAreaResult {
  if (wall.heightMode !== 'EXPLICIT')
    return { status: 'UNKNOWN', reason: 'WALL_HEIGHT_REQUIRES_LEVELS' };
  const issues = openings.flatMap((opening) => validateOpening(opening, wall));
  for (let first = 0; first < openings.length; first += 1) {
    for (let second = first + 1; second < openings.length; second += 1) {
      if (overlaps(openings[first]!, openings[second]!)) {
        issues.push({
          code: 'OVERLAPPING_OPENINGS',
          path: `openings[${first},${second}]`,
          message: 'opening rectangles overlap on the host wall',
        });
      }
    }
  }
  if (issues.length > 0) return { status: 'INVALID', issues };
  const grossAreaMm2 =
    polylineLength({ points: wall.path.points, closed: false }) * wall.heightMm;
  const openingAreaMm2 = openings.reduce(
    (total, opening) => total + opening.widthMm * opening.heightMm,
    0,
  );
  return {
    status: 'OK',
    grossAreaMm2,
    openingAreaMm2,
    netAreaMm2: grossAreaMm2 - openingAreaMm2,
  };
}

function overlaps(first: Opening, second: Opening): boolean {
  const horizontal =
    first.offsetAlongHostMm < second.offsetAlongHostMm + second.widthMm &&
    second.offsetAlongHostMm < first.offsetAlongHostMm + first.widthMm;
  const vertical =
    first.sillHeightMm < second.sillHeightMm + second.heightMm &&
    second.sillHeightMm < first.sillHeightMm + first.heightMm;
  return horizontal && vertical;
}
