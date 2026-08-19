import type { Wall } from '@house-technical-designer/core-domain';
import type { Point2D, Polyline2D } from '@house-technical-designer/geometry';
import { AddWallCommand } from './wall-commands.js';

export interface WallDrawingConstraint {
  readonly orthogonal?: boolean;
  readonly lengthMm?: number;
}

export type WallDrawingState =
  | { readonly status: 'IDLE' }
  | {
      readonly status: 'DRAWING';
      readonly committedPoints: readonly Point2D[];
      readonly pointerPoint?: Point2D;
      readonly preview: Polyline2D;
    };

export interface WallDrawingToolOptions {
  readonly commandId: () => string;
  readonly createWall: (points: readonly Point2D[]) => Wall;
}

/** UI-agnostic transient state machine. Pointer updates never mutate project state or history. */
export class WallDrawingTool {
  readonly #options: WallDrawingToolOptions;
  #state: WallDrawingState = { status: 'IDLE' };

  constructor(options: WallDrawingToolOptions) {
    this.#options = options;
  }

  get state(): WallDrawingState {
    return this.#state;
  }

  start(point: Point2D): WallDrawingState {
    finitePoint(point);
    this.#state = drawingState([point]);
    return this.#state;
  }

  updatePointer(
    point: Point2D,
    constraint: WallDrawingConstraint = {},
  ): WallDrawingState {
    if (this.#state.status !== 'DRAWING') return this.#state;
    const constrained = constrainPoint(
      this.#state.committedPoints.at(-1)!,
      point,
      constraint,
    );
    this.#state = drawingState(this.#state.committedPoints, constrained);
    return this.#state;
  }

  addPoint(
    point: Point2D,
    constraint: WallDrawingConstraint = {},
  ): WallDrawingState {
    if (this.#state.status === 'IDLE') return this.start(point);
    const previous = this.#state.committedPoints.at(-1)!;
    const constrained = constrainPoint(previous, point, constraint);
    if (constrained.x === previous.x && constrained.y === previous.y)
      throw new RangeError('A wall segment must have a positive length.');
    this.#state = drawingState([...this.#state.committedPoints, constrained]);
    return this.#state;
  }

  finish(): AddWallCommand | undefined {
    if (
      this.#state.status !== 'DRAWING' ||
      this.#state.committedPoints.length < 2
    )
      return undefined;
    const wall = this.#options.createWall([...this.#state.committedPoints]);
    const command = new AddWallCommand(this.#options.commandId(), wall);
    this.#state = { status: 'IDLE' };
    return command;
  }

  cancel(): WallDrawingState {
    this.#state = { status: 'IDLE' };
    return this.#state;
  }
}

function drawingState(
  committedPoints: readonly Point2D[],
  pointerPoint?: Point2D,
): WallDrawingState {
  const previewPoints =
    pointerPoint === undefined
      ? committedPoints
      : [...committedPoints, pointerPoint];
  return {
    status: 'DRAWING',
    committedPoints: [...committedPoints],
    ...(pointerPoint === undefined ? {} : { pointerPoint }),
    preview: { points: previewPoints, closed: false },
  };
}

function constrainPoint(
  origin: Point2D,
  target: Point2D,
  constraint: WallDrawingConstraint,
): Point2D {
  finitePoint(target);
  let deltaX = target.x - origin.x;
  let deltaY = target.y - origin.y;
  if (constraint.orthogonal === true) {
    if (Math.abs(deltaX) >= Math.abs(deltaY)) deltaY = 0;
    else deltaX = 0;
  }
  if (constraint.lengthMm !== undefined) {
    if (!Number.isFinite(constraint.lengthMm) || constraint.lengthMm <= 0)
      throw new RangeError('Constrained length must be finite and positive.');
    const currentLength = Math.hypot(deltaX, deltaY);
    if (currentLength === 0)
      throw new RangeError('A direction is required for a constrained length.');
    const scale = constraint.lengthMm / currentLength;
    deltaX *= scale;
    deltaY *= scale;
  }
  return { x: origin.x + deltaX, y: origin.y + deltaY };
}

function finitePoint(point: Point2D): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
    throw new RangeError('Drawing points must be finite.');
}
