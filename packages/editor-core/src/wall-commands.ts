import {
  isWallOpening,
  validateOpening,
  validateWall,
  wallOpenings,
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
      return { valid: false, errors: [`Le mur ${this.wall.id} existe déjà.`] };
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
      return { valid: false, errors: [`Le mur ${this.wallId} n’existe pas.`] };
    const dependants = wallOpenings(state.openings, this.wallId);
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
                  `Le mur ${this.wallId} porte des ouvertures : ${dependants.map(({ id }) => id).join(', ')}. Retirez-les avant de le supprimer.`,
                ]),
            ...(dimensions.length === 0
              ? []
              : [
                  `Le mur ${this.wallId} est coté par ${dimensions.map(({ id }) => id).join(', ')}. Retirez ces cotes avant d’y toucher.`,
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
      return {
        valid: false,
        errors: ['Le déplacement d’un mur doit être un nombre fini.'],
      };
    return state.walls.some(({ id }) => id === this.wallId)
      ? { valid: true }
      : { valid: false, errors: [`Le mur ${this.wallId} n’existe pas.`] };
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

/**
 * Moves one point of a wall path.
 *
 * This is the grip a user drags: the wall keeps its identity, its assembly and
 * its openings, and only the point moves. What the move must not do is leave an
 * opening hanging outside the wall that hosts it, so a move that would shorten
 * the wall past its openings is refused rather than silently clipping them.
 */
export class MoveWallPointCommand implements EditorCommand {
  readonly label = 'Move wall point';
  constructor(
    readonly id: string,
    readonly wallId: Wall['id'],
    readonly pointIndex: number,
    readonly to: Point2D,
  ) {}
  private moved(state: EditorProjectState): Wall | undefined {
    const wall = state.walls.find(({ id }) => id === this.wallId);
    if (wall === undefined) return undefined;
    return {
      ...wall,
      path: {
        points: wall.path.points.map((point, index) =>
          index === this.pointIndex ? { ...this.to } : point,
        ),
      },
    };
  }
  validate(state: EditorProjectState): CommandValidation {
    if (!Number.isFinite(this.to.x) || !Number.isFinite(this.to.y))
      return { valid: false, errors: ['Un point de mur doit être mesurable.'] };
    const wall = state.walls.find(({ id }) => id === this.wallId);
    if (wall === undefined)
      return { valid: false, errors: [`Le mur ${this.wallId} n’existe pas.`] };
    if (
      !Number.isInteger(this.pointIndex) ||
      this.pointIndex < 0 ||
      this.pointIndex >= wall.path.points.length
    )
      return {
        valid: false,
        errors: [`Le mur ${this.wallId} n’a pas de point ${this.pointIndex}.`],
      };
    const next = this.moved(state)!;
    const assembly = state.assemblies.find(({ id }) => id === wall.assemblyId);
    const issues = validateWall(next, assembly);
    if (issues.length > 0)
      return {
        valid: false,
        errors: issues.map(({ path, message }) => `${path}: ${message}`),
      };
    const hosted = wallOpenings(state.openings, this.wallId);
    const errors = hosted.flatMap((opening) =>
      validateOpening(opening, next).map(
        ({ message }) => `Opening ${opening.id} ${message}.`,
      ),
    );
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }
  execute(state: EditorProjectState): CommandExecution {
    const wall = state.walls.find(({ id }) => id === this.wallId);
    if (wall === undefined)
      throw new Error('Move wall point executed without validation.');
    const previous = wall.path.points[this.pointIndex]!;
    const next = this.moved(state)!;
    return {
      nextState: {
        ...state,
        walls: state.walls.map((entry) =>
          entry.id === this.wallId ? next : entry,
        ),
      },
      inverse: new MoveWallPointCommand(
        `${this.id}:inverse`,
        this.wallId,
        this.pointIndex,
        { ...previous },
      ),
      changes: changes(this.wallId),
    };
  }
}

/**
 * Replaces the whole path of a wall.
 *
 * Turning a wall or reflecting it moves every one of its points at once, and
 * moving them one at a time is not the same thing: an intermediate state has a
 * length the wall never has, and an opening that fits before and after would be
 * refused in between. The new path is therefore validated as a whole, openings
 * included, and applied in one step.
 */
export class SetWallPathCommand implements EditorCommand {
  readonly label = 'Set wall path';
  constructor(
    readonly id: string,
    readonly wallId: Wall['id'],
    readonly points: readonly Point2D[],
  ) {}
  private reshaped(state: EditorProjectState): Wall | undefined {
    const wall = state.walls.find(({ id }) => id === this.wallId);
    if (wall === undefined) return undefined;
    return {
      ...wall,
      path: { points: this.points.map((point) => ({ ...point })) },
    };
  }
  validate(state: EditorProjectState): CommandValidation {
    const wall = state.walls.find(({ id }) => id === this.wallId);
    if (wall === undefined)
      return { valid: false, errors: [`Le mur ${this.wallId} n’existe pas.`] };
    if (this.points.length !== wall.path.points.length)
      return {
        valid: false,
        errors: [
          `Le mur ${this.wallId} a ${wall.path.points.length} points, et non ${this.points.length}.`,
        ],
      };
    if (
      this.points.some(
        (point) => !Number.isFinite(point.x) || !Number.isFinite(point.y),
      )
    )
      return {
        valid: false,
        errors: ['Les points d’un mur doivent être mesurables.'],
      };
    const next = this.reshaped(state)!;
    const assembly = state.assemblies.find(({ id }) => id === wall.assemblyId);
    const issues = validateWall(next, assembly);
    if (issues.length > 0)
      return {
        valid: false,
        errors: issues.map(({ path, message }) => `${path}: ${message}`),
      };
    const errors = wallOpenings(state.openings, this.wallId).flatMap(
      (opening) =>
        validateOpening(opening, next).map(
          ({ message }) => `Opening ${opening.id} ${message}.`,
        ),
    );
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }
  execute(state: EditorProjectState): CommandExecution {
    const wall = state.walls.find(({ id }) => id === this.wallId);
    if (wall === undefined)
      throw new Error('Set wall path executed without validation.');
    const next = this.reshaped(state)!;
    return {
      nextState: {
        ...state,
        walls: state.walls.map((entry) =>
          entry.id === this.wallId ? next : entry,
        ),
      },
      inverse: new SetWallPathCommand(
        `${this.id}:inverse`,
        this.wallId,
        wall.path.points.map((point) => ({ ...point })),
      ),
      changes: changes(this.wallId),
    };
  }
}

/**
 * Cuts a wall in two at a point along its axis.
 *
 * Each piece keeps the assembly, the height and the role of the wall it came
 * from; the openings follow the piece that actually contains them. A cut that
 * would fall inside an opening is refused: half a window is not a window, and
 * choosing which side to keep it on is not the application's decision.
 */
export class SplitWallCommand implements EditorCommand {
  readonly label = 'Split wall';
  constructor(
    readonly id: string,
    readonly wallId: Wall['id'],
    readonly at: Point2D,
    readonly newWallId: Wall['id'],
  ) {}
  private cut(state: EditorProjectState):
    | {
        readonly first: Wall;
        readonly second: Wall;
        readonly distanceMm: number;
        readonly totalMm: number;
      }
    | undefined {
    const wall = state.walls.find(({ id }) => id === this.wallId);
    if (wall === undefined || wall.path.points.length !== 2) return undefined;
    const start = wall.path.points[0]!;
    const end = wall.path.points[1]!;
    const axis = { x: end.x - start.x, y: end.y - start.y };
    const totalMm = Math.hypot(axis.x, axis.y);
    if (totalMm === 0) return undefined;
    const ratio =
      ((this.at.x - start.x) * axis.x + (this.at.y - start.y) * axis.y) /
      (totalMm * totalMm);
    const distanceMm = ratio * totalMm;
    const point = {
      x: start.x + axis.x * ratio,
      y: start.y + axis.y * ratio,
    };
    return {
      first: { ...wall, path: { points: [start, point] } },
      second: {
        ...wall,
        id: this.newWallId,
        path: { points: [point, end] },
      },
      distanceMm,
      totalMm,
    };
  }
  validate(state: EditorProjectState): CommandValidation {
    if (!Number.isFinite(this.at.x) || !Number.isFinite(this.at.y))
      return {
        valid: false,
        errors: ['Le point de scission doit être mesurable.'],
      };
    if (state.walls.some(({ id }) => id === this.newWallId))
      return {
        valid: false,
        errors: [`Le mur ${this.newWallId} existe déjà.`],
      };
    const wall = state.walls.find(({ id }) => id === this.wallId);
    if (wall === undefined)
      return { valid: false, errors: [`Le mur ${this.wallId} n’existe pas.`] };
    if (wall.path.points.length !== 2)
      return {
        valid: false,
        errors: [
          `Le mur ${this.wallId} compte plusieurs segments : scindez-le segment par segment.`,
        ],
      };
    const cut = this.cut(state);
    if (cut === undefined)
      return {
        valid: false,
        errors: [`Le mur ${this.wallId} n’a pas de longueur.`],
      };
    if (cut.distanceMm <= 0 || cut.distanceMm >= cut.totalMm)
      return {
        valid: false,
        errors: ['Le point de scission doit tomber à l’intérieur du mur.'],
      };
    const crossed = wallOpenings(state.openings, this.wallId).filter(
      (opening) =>
        opening.offsetAlongHostMm < cut.distanceMm &&
        opening.offsetAlongHostMm + opening.widthMm > cut.distanceMm,
    );
    if (crossed.length > 0)
      return {
        valid: false,
        errors: [
          `Le point de scission tombe dans ${crossed.map(({ id }) => id).join(', ')}.`,
        ],
      };
    const dimensions = state.dimensions.filter(
      ({ first, second }) =>
        first.wallId === this.wallId || second.wallId === this.wallId,
    );
    return dimensions.length === 0
      ? { valid: true }
      : {
          valid: false,
          errors: [
            `Le mur ${this.wallId} est coté par ${dimensions.map(({ id }) => id).join(', ')}. Retirez ces cotes avant d’y toucher.`,
          ],
        };
  }
  execute(state: EditorProjectState): CommandExecution {
    const cut = this.cut(state);
    if (cut === undefined)
      throw new Error('Split wall executed without validation.');
    const openings: readonly Opening[] = state.openings.map((opening) => {
      if (!isWallOpening(opening) || opening.host.id !== this.wallId)
        return opening;
      return opening.offsetAlongHostMm < cut.distanceMm
        ? opening
        : {
            ...opening,
            host: { kind: 'WALL' as const, id: this.newWallId },
            offsetAlongHostMm: opening.offsetAlongHostMm - cut.distanceMm,
          };
    });
    const walls = state.walls.flatMap((wall) =>
      wall.id === this.wallId ? [cut.first, cut.second] : [wall],
    );
    return {
      nextState: { ...state, walls, openings },
      inverse: new JoinSplitWallsCommand(
        `${this.id}:inverse`,
        this.wallId,
        this.newWallId,
        state.walls.find(({ id }) => id === this.wallId)!,
        state.openings,
      ),
      changes: {
        objectIds: [this.wallId, this.newWallId],
        domains: ['geometry', 'spaces', 'quantities', 'drawing'],
        paths: [`walls/${this.wallId}`, `walls/${this.newWallId}`],
      },
    };
  }
}

/** Puts back a wall a split had cut in two; the inverse of {@link SplitWallCommand}. */
export class JoinSplitWallsCommand implements EditorCommand {
  readonly label = 'Join split walls';
  constructor(
    readonly id: string,
    readonly wallId: Wall['id'],
    readonly removedWallId: Wall['id'],
    readonly restored: Wall,
    readonly openings: EditorProjectState['openings'],
  ) {}
  validate(state: EditorProjectState): CommandValidation {
    return state.walls.some(({ id }) => id === this.removedWallId)
      ? { valid: true }
      : {
          valid: false,
          errors: [`Le mur ${this.removedWallId} n’existe pas.`],
        };
  }
  execute(state: EditorProjectState): CommandExecution {
    const walls = state.walls
      .filter(({ id }) => id !== this.removedWallId)
      .map((wall) => (wall.id === this.wallId ? this.restored : wall));
    return {
      nextState: {
        ...state,
        walls,
        openings: this.openings.map((opening) => ({ ...opening })),
      },
      inverse: new SplitWallCommand(
        `${this.id}:inverse`,
        this.wallId,
        this.restored.path.points[1]!,
        this.removedWallId,
      ),
      changes: {
        objectIds: [this.wallId, this.removedWallId],
        domains: ['geometry', 'spaces', 'quantities', 'drawing'],
        paths: [`walls/${this.wallId}`],
      },
    };
  }
}
