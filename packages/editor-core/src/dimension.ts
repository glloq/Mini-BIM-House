import type { Wall } from '@house-technical-designer/core-domain';
import type { Point2D } from '@house-technical-designer/geometry';
import type {
  ChangeSet,
  CommandExecution,
  CommandValidation,
  EditorCommand,
  EditorProjectState,
} from './commands.js';

declare const dimensionIdBrand: unique symbol;
export type DimensionId = string & { readonly [dimensionIdBrand]: true };
export type DimensionType = 'ALIGNED' | 'HORIZONTAL' | 'VERTICAL';
export interface WallEndpointReference {
  readonly kind: 'WALL_ENDPOINT';
  readonly wallId: Wall['id'];
  readonly endpoint: 'START' | 'END';
}
export interface Dimension {
  readonly id: DimensionId;
  readonly type: DimensionType;
  readonly first: WallEndpointReference;
  readonly second: WallEndpointReference;
  readonly offsetMm: number;
  /** Display only: never replaces the resolved numeric value. */
  readonly overrideText?: string;
}
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

export class AddDimensionCommand implements EditorCommand {
  readonly label = 'Add dimension';
  constructor(
    readonly id: string,
    readonly dimension: Dimension,
  ) {}
  validate(state: EditorProjectState): CommandValidation {
    if (state.dimensions.some(({ id }) => id === this.dimension.id))
      return {
        valid: false,
        errors: [`Dimension ${this.dimension.id} already exists.`],
      };
    if (!Number.isFinite(this.dimension.offsetMm))
      return { valid: false, errors: ['Dimension offset must be finite.'] };
    const resolution = resolveDimension(this.dimension, state.walls);
    return resolution.status === 'OK'
      ? { valid: true }
      : {
          valid: false,
          errors: [
            `Dimension references missing walls: ${resolution.missingWallIds.join(', ')}.`,
          ],
        };
  }
  execute(state: EditorProjectState): CommandExecution {
    return {
      nextState: {
        ...state,
        dimensions: [...state.dimensions, this.dimension],
      },
      inverse: new DeleteDimensionCommand(
        `${this.id}:inverse`,
        this.dimension.id,
      ),
      changes: dimensionChanges(this.dimension),
    };
  }
}

export class DeleteDimensionCommand implements EditorCommand {
  readonly label = 'Delete dimension';
  constructor(
    readonly id: string,
    readonly dimensionId: DimensionId,
  ) {}
  validate(state: EditorProjectState): CommandValidation {
    return state.dimensions.some(({ id }) => id === this.dimensionId)
      ? { valid: true }
      : {
          valid: false,
          errors: [`Dimension ${this.dimensionId} does not exist.`],
        };
  }
  execute(state: EditorProjectState): CommandExecution {
    const dimension = state.dimensions.find(
      ({ id }) => id === this.dimensionId,
    );
    if (dimension === undefined)
      throw new Error('Delete dimension executed without validation.');
    return {
      nextState: {
        ...state,
        dimensions: state.dimensions.filter(
          ({ id }) => id !== this.dimensionId,
        ),
      },
      inverse: new AddDimensionCommand(`${this.id}:inverse`, dimension),
      changes: dimensionChanges(dimension),
    };
  }
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

function dimensionChanges(dimension: Dimension): ChangeSet {
  return {
    objectIds: [dimension.id, dimension.first.wallId, dimension.second.wallId],
    domains: ['dimensions', 'drawing'],
    paths: [`dimensions/${dimension.id}`],
  };
}
