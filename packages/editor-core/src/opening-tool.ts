import {
  validateOpening,
  type Opening,
  type Wall,
} from '@house-technical-designer/core-domain';
import type { Point2D } from '@house-technical-designer/geometry';
import type {
  ChangeSet,
  CommandExecution,
  CommandValidation,
  EditorCommand,
  EditorProjectState,
} from './commands.js';

const openingChanges = (id: string, hostId: string): ChangeSet => ({
  objectIds: [id, hostId],
  domains: ['openings', 'geometry', 'spaces', 'quantities', 'drawing'],
  paths: [`openings/${id}`, `walls/${hostId}`],
});

export class AddOpeningCommand implements EditorCommand {
  readonly label = 'Add opening';
  constructor(
    readonly id: string,
    readonly opening: Opening,
  ) {}
  validate(state: EditorProjectState): CommandValidation {
    if (state.openings.some(({ id }) => id === this.opening.id))
      return {
        valid: false,
        errors: [`Opening ${this.opening.id} already exists.`],
      };
    const host = state.walls.find(
      ({ id }) => id === this.opening.hostElementId,
    );
    if (host === undefined)
      return {
        valid: false,
        errors: [`Host wall ${this.opening.hostElementId} does not exist.`],
      };
    const issues = validateOpening(this.opening, host);
    return issues.length === 0
      ? { valid: true }
      : {
          valid: false,
          errors: issues.map(({ path, message }) => `${path}: ${message}`),
        };
  }
  execute(state: EditorProjectState): CommandExecution {
    return {
      nextState: { ...state, openings: [...state.openings, this.opening] },
      inverse: new DeleteOpeningCommand(`${this.id}:inverse`, this.opening.id),
      changes: openingChanges(this.opening.id, this.opening.hostElementId),
    };
  }
}

export class DeleteOpeningCommand implements EditorCommand {
  readonly label = 'Delete opening';
  constructor(
    readonly id: string,
    readonly openingId: Opening['id'],
  ) {}
  validate(state: EditorProjectState): CommandValidation {
    return state.openings.some(({ id }) => id === this.openingId)
      ? { valid: true }
      : { valid: false, errors: [`Opening ${this.openingId} does not exist.`] };
  }
  execute(state: EditorProjectState): CommandExecution {
    const opening = state.openings.find(({ id }) => id === this.openingId);
    if (opening === undefined)
      throw new Error('Delete opening executed without validation.');
    return {
      nextState: {
        ...state,
        openings: state.openings.filter(({ id }) => id !== this.openingId),
      },
      inverse: new AddOpeningCommand(`${this.id}:inverse`, opening),
      changes: openingChanges(opening.id, opening.hostElementId),
    };
  }
}

export interface OpeningPlacement {
  readonly host: Wall;
  readonly projectedPoint: Point2D;
  readonly offsetAlongHostMm: number;
  readonly distanceToHostMm: number;
}

export interface OpeningInsertionOptions {
  readonly maximumHostDistanceMm: number;
  readonly commandId: () => string;
  readonly createOpening: (placement: OpeningPlacement) => Opening;
}

export function createOpeningInsertionCommand(
  point: Point2D,
  walls: readonly Wall[],
  options: OpeningInsertionOptions,
): AddOpeningCommand | undefined {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
    throw new RangeError('Insertion point must be finite.');
  if (
    !Number.isFinite(options.maximumHostDistanceMm) ||
    options.maximumHostDistanceMm < 0
  )
    throw new RangeError('Host distance must be finite and non-negative.');
  const placements = walls
    .map((host) => projectToWall(point, host))
    .filter((value): value is OpeningPlacement => value !== undefined);
  placements.sort(
    (first, second) =>
      first.distanceToHostMm - second.distanceToHostMm ||
      first.host.id.localeCompare(second.host.id),
  );
  const placement = placements[0];
  if (
    placement === undefined ||
    placement.distanceToHostMm > options.maximumHostDistanceMm
  )
    return undefined;
  return new AddOpeningCommand(
    options.commandId(),
    options.createOpening(placement),
  );
}

function projectToWall(
  point: Point2D,
  host: Wall,
): OpeningPlacement | undefined {
  let accumulatedLength = 0;
  let best: OpeningPlacement | undefined;
  for (let index = 1; index < host.path.points.length; index += 1) {
    const start = host.path.points[index - 1]!;
    const end = host.path.points[index]!;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) continue;
    const parameter = Math.max(
      0,
      Math.min(
        1,
        ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
      ),
    );
    const projectedPoint = {
      x: start.x + dx * parameter,
      y: start.y + dy * parameter,
    };
    const distanceToHostMm = Math.hypot(
      point.x - projectedPoint.x,
      point.y - projectedPoint.y,
    );
    const placement = {
      host,
      projectedPoint,
      offsetAlongHostMm:
        accumulatedLength + Math.sqrt(lengthSquared) * parameter,
      distanceToHostMm,
    };
    if (
      best === undefined ||
      placement.distanceToHostMm < best.distanceToHostMm
    )
      best = placement;
    accumulatedLength += Math.sqrt(lengthSquared);
  }
  return best;
}
