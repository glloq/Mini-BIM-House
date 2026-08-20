import type { Point2D } from '@house-technical-designer/geometry';
import type { Wall } from './wall.js';

declare const dimensionIdBrand: unique symbol;
export type DimensionId = string & { readonly [dimensionIdBrand]: true };

export type DimensionType = 'ALIGNED' | 'HORIZONTAL' | 'VERTICAL';

/**
 * What a dimension measures.
 *
 * A dimension never stores a length. It stores what it measures — two wall
 * endpoints — so moving a wall moves its dimension with it, and a dimension can
 * never disagree with the drawing it annotates.
 */
export interface WallEndpointReference {
  readonly kind: 'WALL_ENDPOINT';
  readonly wallId: Wall['id'];
  readonly endpoint: 'START' | 'END';
}

export interface Dimension {
  readonly id: DimensionId;
  /** Discriminates this annotation from the other kinds a level may carry. */
  readonly kind: 'DIMENSION';
  readonly type: DimensionType;
  readonly first: WallEndpointReference;
  readonly second: WallEndpointReference;
  /** Perpendicular distance from the measured line, in millimetres. */
  readonly offsetMm: number;
  /** Display only: never replaces the resolved numeric value. */
  readonly overrideText?: string;
}

/** Everything a level may carry as an annotation. */
export type Annotation = Dimension;

export type DimensionResolution =
  | {
      readonly status: 'OK';
      readonly valueMm: number;
      readonly firstPoint: Point2D;
      readonly secondPoint: Point2D;
    }
  | {
      readonly status: 'UNKNOWN';
      readonly missingWallIds: readonly Wall['id'][];
    };

export function dimensionId(value: string): DimensionId {
  if (value.trim() === '')
    throw new TypeError('Dimension ID must not be empty.');
  return value as DimensionId;
}

export function isDimension(value: unknown): value is Dimension {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'DIMENSION'
  );
}

/**
 * Resolves the value a dimension measures against the walls it references.
 *
 * A dimension whose walls no longer exist resolves to UNKNOWN and names them:
 * it never falls back to the last value it happened to show.
 */
export function resolveDimension(
  dimension: Dimension,
  walls: readonly Wall[],
): DimensionResolution {
  const firstPoint = resolveReference(dimension.first, walls);
  const secondPoint = resolveReference(dimension.second, walls);
  const missing = [
    firstPoint === undefined ? dimension.first.wallId : undefined,
    secondPoint === undefined ? dimension.second.wallId : undefined,
  ].filter((value): value is Wall['id'] => value !== undefined);
  if (missing.length > 0)
    return { status: 'UNKNOWN', missingWallIds: [...new Set(missing)] };
  const dx = secondPoint!.x - firstPoint!.x;
  const dy = secondPoint!.y - firstPoint!.y;
  const valueMm =
    dimension.type === 'HORIZONTAL'
      ? Math.abs(dx)
      : dimension.type === 'VERTICAL'
        ? Math.abs(dy)
        : Math.hypot(dx, dy);
  return {
    status: 'OK',
    valueMm,
    firstPoint: firstPoint!,
    secondPoint: secondPoint!,
  };
}

function resolveReference(
  reference: WallEndpointReference,
  walls: readonly Wall[],
): Point2D | undefined {
  const wall = walls.find(({ id }) => id === reference.wallId);
  if (wall === undefined) return undefined;
  return reference.endpoint === 'START'
    ? wall.path.points[0]
    : wall.path.points.at(-1);
}
