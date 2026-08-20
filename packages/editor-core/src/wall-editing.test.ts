import { describe, expect, it } from 'vitest';
import {
  entityId,
  type Opening,
  type Wall,
} from '@house-technical-designer/core-domain';
import { assemblyId } from '@house-technical-designer/assemblies';
import type { EditorProjectState } from './commands.js';
import { MoveWallPointCommand, SplitWallCommand } from './wall-commands.js';

function wall(id: string, toX: number): Wall {
  return {
    id: entityId<'Wall'>(id),
    type: 'WALL',
    levelId: entityId<'Level'>('ground'),
    assemblyId: assemblyId('wall'),
    path: {
      points: [
        { x: 0, y: 0 },
        { x: toX, y: 0 },
      ],
    },
    referenceSide: 'CENTER',
    baseOffsetMm: 0,
    heightMode: 'EXPLICIT',
    heightMm: 2500,
    role: 'EXTERIOR',
  };
}

function opening(id: string, offsetAlongHostMm: number): Opening {
  return {
    id: entityId<'Opening'>(id),
    type: 'OPENING',
    openingType: 'WINDOW',
    hostElementId: entityId<'Wall'>('wall'),
    offsetAlongHostMm,
    sillHeightMm: 900,
    widthMm: 1000,
    heightMm: 1200,
  };
}

function state(openings: readonly Opening[] = []): EditorProjectState {
  return {
    walls: [wall('wall', 6000)],
    openings,
    assemblies: [
      { id: assemblyId('wall'), name: 'Mur', category: 'WALL', layers: [] },
    ],
    dimensions: [],
  };
}

const apply = (
  command: {
    validate: (s: EditorProjectState) => { valid: boolean };
    execute: (s: EditorProjectState) => { nextState: EditorProjectState };
  },
  from: EditorProjectState,
): EditorProjectState => command.execute(from).nextState;

describe('dragging the end of a wall', () => {
  it('moves the point and leaves everything else alone', () => {
    const command = new MoveWallPointCommand(
      'move',
      entityId<'Wall'>('wall'),
      1,
      {
        x: 4000,
        y: 500,
      },
    );
    expect(command.validate(state())).toEqual({ valid: true });
    const next = apply(command, state());
    expect(next.walls[0]?.path.points).toEqual([
      { x: 0, y: 0 },
      { x: 4000, y: 500 },
    ]);
    expect(next.walls[0]?.assemblyId).toBe('wall');
  });

  it('undoes back to the point it started from', () => {
    const command = new MoveWallPointCommand(
      'move',
      entityId<'Wall'>('wall'),
      1,
      {
        x: 4000,
        y: 0,
      },
    );
    const execution = command.execute(state());
    const back = execution.inverse.execute(execution.nextState).nextState;
    expect(back.walls[0]?.path.points[1]).toEqual({ x: 6000, y: 0 });
  });

  it('refuses a move that would leave an opening outside its wall', () => {
    // The window ends at 5 500 mm; a wall 3 m long cannot host it.
    const command = new MoveWallPointCommand(
      'move',
      entityId<'Wall'>('wall'),
      1,
      {
        x: 3000,
        y: 0,
      },
    );
    const result = command.validate(state([opening('window', 4500)]));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors[0]).toContain('window');
  });

  it('refuses a move that would give the wall no length', () => {
    const command = new MoveWallPointCommand(
      'move',
      entityId<'Wall'>('wall'),
      1,
      {
        x: 0,
        y: 0,
      },
    );
    expect(command.validate(state()).valid).toBe(false);
  });
});

describe('cutting a wall in two', () => {
  const split = (at: number, openings: readonly Opening[] = []) => ({
    command: new SplitWallCommand(
      'split',
      entityId<'Wall'>('wall'),
      { x: at, y: 0 },
      entityId<'Wall'>('wall-b'),
    ),
    from: state(openings),
  });

  it('produces two walls that share the cut point', () => {
    const { command, from } = split(2500);
    expect(command.validate(from)).toEqual({ valid: true });
    const next = apply(command, from);
    expect(next.walls.map(({ id }) => id)).toEqual(['wall', 'wall-b']);
    expect(next.walls[0]?.path.points[1]).toEqual({ x: 2500, y: 0 });
    expect(next.walls[1]?.path.points).toEqual([
      { x: 2500, y: 0 },
      { x: 6000, y: 0 },
    ]);
  });

  it('gives each opening to the piece that holds it', () => {
    const { command, from } = split(3000, [
      opening('near', 500),
      opening('far', 4000),
    ]);
    const next = apply(command, from);
    expect(next.openings[0]).toMatchObject({
      id: 'near',
      hostElementId: 'wall',
      offsetAlongHostMm: 500,
    });
    // Measured from the start of the piece that now hosts it.
    expect(next.openings[1]).toMatchObject({
      id: 'far',
      hostElementId: 'wall-b',
      offsetAlongHostMm: 1000,
    });
  });

  it('refuses to cut through an opening', () => {
    const { command, from } = split(1000, [opening('window', 500)]);
    const result = command.validate(from);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors[0]).toContain('window');
  });

  it('refuses a cut outside the wall', () => {
    expect(split(-100).command.validate(split(-100).from).valid).toBe(false);
    expect(split(6000).command.validate(split(6000).from).valid).toBe(false);
  });

  it('joins the two pieces back on undo, openings included', () => {
    const { command, from } = split(3000, [
      opening('near', 500),
      opening('far', 4000),
    ]);
    const execution = command.execute(from);
    const back = execution.inverse.execute(execution.nextState).nextState;
    expect(back.walls.map(({ id }) => id)).toEqual(['wall']);
    expect(back.walls[0]?.path.points[1]).toEqual({ x: 6000, y: 0 });
    expect(
      back.openings.map(({ hostElementId, offsetAlongHostMm }) => [
        hostElementId,
        offsetAlongHostMm,
      ]),
    ).toEqual([
      ['wall', 500],
      ['wall', 4000],
    ]);
  });
});
