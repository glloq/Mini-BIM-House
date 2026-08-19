import { validateWall, type Wall } from '@house-technical-designer/core-domain';
import type { Point2D } from '@house-technical-designer/geometry';
import type {
  ChangeSet,
  CommandExecution,
  CommandValidation,
  EditorCommand,
  EditorProjectState,
} from './commands.js';

const changes = (id: string): ChangeSet => ({
  objectIds: [id],
  domains: ['geometry', 'spaces', 'quantities', 'drawing'],
  paths: [`walls/${id}`],
});

export class AddWallCommand implements EditorCommand {
  readonly label = 'Add wall';
  constructor(
    readonly id: string,
    readonly wall: Wall,
  ) {}
  validate(state: EditorProjectState): CommandValidation {
    if (state.walls.some(({ id }) => id === this.wall.id))
      return { valid: false, errors: [`Wall ${this.wall.id} already exists.`] };
    const assembly = state.assemblies.find(
      ({ id }) => id === this.wall.assemblyId,
    );
    const issues = validateWall(this.wall, assembly);
    return issues.length === 0
      ? { valid: true }
      : {
          valid: false,
          errors: issues.map(({ path, message }) => `${path}: ${message}`),
        };
  }
  execute(state: EditorProjectState): CommandExecution {
    return {
      nextState: { ...state, walls: [...state.walls, this.wall] },
      inverse: new DeleteWallCommand(`${this.id}:inverse`, this.wall.id),
      changes: changes(this.wall.id),
    };
  }
}

export class DeleteWallCommand implements EditorCommand {
  readonly label = 'Delete wall';
  constructor(
    readonly id: string,
    readonly wallId: Wall['id'],
  ) {}
  validate(state: EditorProjectState): CommandValidation {
    if (!state.walls.some(({ id }) => id === this.wallId))
      return { valid: false, errors: [`Wall ${this.wallId} does not exist.`] };
    const dependants = state.openings.filter(
      ({ hostElementId }) => hostElementId === this.wallId,
    );
    const dimensions = state.dimensions.filter(
      ({ first, second }) =>
        first.wallId === this.wallId || second.wallId === this.wallId,
    );
    return dependants.length === 0 && dimensions.length === 0
      ? { valid: true }
      : {
          valid: false,
          errors: [
            ...(dependants.length === 0
              ? []
              : [
                  `Wall ${this.wallId} hosts openings: ${dependants.map(({ id }) => id).join(', ')}.`,
                ]),
            ...(dimensions.length === 0
              ? []
              : [
                  `Wall ${this.wallId} is referenced by dimensions: ${dimensions.map(({ id }) => id).join(', ')}.`,
                ]),
          ],
        };
  }
  execute(state: EditorProjectState): CommandExecution {
    const wall = state.walls.find(({ id }) => id === this.wallId);
    if (wall === undefined)
      throw new Error('Delete wall executed without validation.');
    return {
      nextState: {
        ...state,
        walls: state.walls.filter(({ id }) => id !== this.wallId),
      },
      inverse: new AddWallCommand(`${this.id}:inverse`, wall),
      changes: changes(this.wallId),
    };
  }
}

export class MoveWallCommand implements EditorCommand {
  readonly label = 'Move wall';
  constructor(
    readonly id: string,
    readonly wallId: Wall['id'],
    readonly deltaMm: Point2D,
  ) {}
  validate(state: EditorProjectState): CommandValidation {
    if (!Number.isFinite(this.deltaMm.x) || !Number.isFinite(this.deltaMm.y))
      return { valid: false, errors: ['Wall movement must be finite.'] };
    return state.walls.some(({ id }) => id === this.wallId)
      ? { valid: true }
      : { valid: false, errors: [`Wall ${this.wallId} does not exist.`] };
  }
  execute(state: EditorProjectState): CommandExecution {
    const walls = state.walls.map((wall) =>
      wall.id === this.wallId
        ? {
            ...wall,
            path: {
              points: wall.path.points.map(({ x, y }) => ({
                x: x + this.deltaMm.x,
                y: y + this.deltaMm.y,
              })),
            },
          }
        : wall,
    );
    return {
      nextState: { ...state, walls },
      inverse: new MoveWallCommand(`${this.id}:inverse`, this.wallId, {
        x: -this.deltaMm.x,
        y: -this.deltaMm.y,
      }),
      changes: changes(this.wallId),
    };
  }
}
