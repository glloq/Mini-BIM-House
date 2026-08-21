import type { Point2D } from '@house-technical-designer/geometry';
import type { LevelId, StairId } from './ids.js';

export const STAIR_TYPES = [
  'STRAIGHT',
  'L_SHAPED',
  'U_SHAPED',
  'SPIRAL',
] as const;
export type StairType = (typeof STAIR_TYPES)[number];

export function isStairType(value: string): value is StairType {
  return (STAIR_TYPES as readonly string[]).includes(value);
}

/**
 * A flat stretch in a flight, after a given number of risers.
 *
 * A landing is where a flight stops climbing, so it is described by the step
 * it follows rather than by a distance: inserting a riser below it must not
 * leave the landing floating between two steps.
 */
export interface StairLanding {
  readonly afterRiser: number;
  readonly depthMm: number;
}

/**
 * A stair between two storeys.
 *
 * The rise a stair has to climb is the distance between the two storeys, and
 * the height of one riser is that distance divided by the number of risers.
 * Neither is stored: a riser height written here would be a second answer to a
 * question the storeys already answer, and the two would disagree the first
 * time a storey moved.
 */
export interface Stair {
  readonly id: StairId;
  readonly type: 'STAIR';
  readonly levelId: LevelId;
  /** The storey the stair arrives at. */
  readonly topLevelId: LevelId;
  readonly stairType: StairType;
  readonly widthMm: number;
  /** How many risers the flight climbs; the height of one follows. */
  readonly riserCount: number;
  readonly treadDepthMm: number;
  /** The walking line, from the first step to the last. */
  readonly path: { readonly points: readonly Point2D[] };
  readonly landings?: readonly StairLanding[];
}

export type StairIssueCode =
  | 'INVALID_PATH'
  | 'INVALID_WIDTH'
  | 'INVALID_RISER_COUNT'
  | 'INVALID_TREAD_DEPTH'
  | 'INVALID_TYPE'
  | 'INVALID_LANDING';

export interface StairIssue {
  readonly code: StairIssueCode;
  readonly path: string;
  readonly message: string;
}

export function validateStair(stair: Stair): readonly StairIssue[] {
  const issues: StairIssue[] = [];
  if (stair.path.points.length < 2)
    issues.push({
      code: 'INVALID_PATH',
      path: 'path.points',
      message: 'must have at least two points',
    });
  if (
    stair.path.points.some(
      ({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y),
    )
  )
    issues.push({
      code: 'INVALID_PATH',
      path: 'path.points',
      message: 'must be finite',
    });
  if (!Number.isFinite(stair.widthMm) || stair.widthMm <= 0)
    issues.push({
      code: 'INVALID_WIDTH',
      path: 'widthMm',
      message: 'must be finite and greater than zero',
    });
  if (!Number.isInteger(stair.riserCount) || stair.riserCount < 2)
    issues.push({
      code: 'INVALID_RISER_COUNT',
      path: 'riserCount',
      message: 'must be a whole number of at least two',
    });
  if (!Number.isFinite(stair.treadDepthMm) || stair.treadDepthMm <= 0)
    issues.push({
      code: 'INVALID_TREAD_DEPTH',
      path: 'treadDepthMm',
      message: 'must be finite and greater than zero',
    });
  if (!isStairType(stair.stairType))
    issues.push({
      code: 'INVALID_TYPE',
      path: 'stairType',
      message: `must be one of ${STAIR_TYPES.join(', ')}`,
    });
  for (const [index, landing] of (stair.landings ?? []).entries()) {
    if (
      !Number.isInteger(landing.afterRiser) ||
      landing.afterRiser < 1 ||
      landing.afterRiser >= stair.riserCount
    )
      issues.push({
        code: 'INVALID_LANDING',
        path: `landings[${index}].afterRiser`,
        message: `must fall between the first and the last riser`,
      });
    if (!Number.isFinite(landing.depthMm) || landing.depthMm <= 0)
      issues.push({
        code: 'INVALID_LANDING',
        path: `landings[${index}].depthMm`,
        message: 'must be finite and greater than zero',
      });
  }
  return issues;
}

/**
 * What the stair actually measures, derived from the storeys it joins.
 *
 * Everything here follows from the rise, the riser count and the tread depth;
 * none of it is stored, so a storey that moves moves the stair with it.
 */
export interface StairDimensions {
  readonly riseMm: number;
  readonly riserHeightMm: number;
  /** Horizontal length of the flight, landings included. */
  readonly runMm: number;
  /**
   * The comfort rule, in millimetres: two risers plus one tread.
   *
   * A comfortable stair lands between 590 and 650; the value is reported and
   * never corrected, because widening a stair to satisfy a rule of thumb is a
   * decision for the person drawing the house.
   */
  readonly blondelMm: number;
  /** The walking line as it is drawn, from the first point to the last. */
  readonly pathLengthMm: number;
  /**
   * How much longer the drawn line is than the flight it carries.
   *
   * Negative when the line is too short — the flight then needs more floor
   * than the plan gives it. The two lengths are two answers to the same
   * question, and nothing in the model forces them to agree: the run follows
   * from the riser count, the tread depth and the landings, while the line is
   * drawn by hand. Reporting the gap is the only way the drawing and the
   * numbers stop disagreeing in silence.
   */
  readonly pathDifferenceMm: number;
  /** Whether the two agree to within {@link STAIR_PATH_TOLERANCE_MM}. */
  readonly pathMatchesRun: boolean;
}

/**
 * How far the drawn walking line may sit from the flight it carries.
 *
 * A centimetre: below that the difference is drawing precision, above it the
 * plan and the dimensions describe two different stairs.
 */
export const STAIR_PATH_TOLERANCE_MM = 10;

/** The length of the walking line, in the order its points are written. */
export function stairPathLengthMm(stair: Stair): number {
  const points = stair.path.points;
  let total = 0;
  for (let index = 1; index < points.length; index += 1)
    total += Math.hypot(
      points[index]!.x - points[index - 1]!.x,
      points[index]!.y - points[index - 1]!.y,
    );
  return total;
}

export function stairDimensions(stair: Stair, riseMm: number): StairDimensions {
  const riserHeightMm = stair.riserCount > 0 ? riseMm / stair.riserCount : 0;
  const landings = (stair.landings ?? []).reduce(
    (total, landing) => total + landing.depthMm,
    0,
  );
  // One fewer tread than risers: the last riser arrives on the storey above,
  // which is not a tread of the stair.
  const runMm =
    Math.max(0, stair.riserCount - 1) * stair.treadDepthMm + landings;
  const pathLengthMm = stairPathLengthMm(stair);
  const pathDifferenceMm = pathLengthMm - runMm;
  return {
    riseMm,
    riserHeightMm,
    runMm,
    blondelMm: 2 * riserHeightMm + stair.treadDepthMm,
    pathLengthMm,
    pathDifferenceMm,
    pathMatchesRun: Math.abs(pathDifferenceMm) <= STAIR_PATH_TOLERANCE_MM,
  };
}
