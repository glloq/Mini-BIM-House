import { describe, expect, it } from 'vitest';
import {
  assemblyId,
  assemblyLayerId,
  type Assembly,
} from '@house-technical-designer/assemblies';
import { entityId, type Wall } from '@house-technical-designer/core-domain';
import { materialId } from '@house-technical-designer/materials';
import {
  AddWallCommand,
  CommandDispatcher,
  DeleteWallCommand,
  MoveWallCommand,
  TransactionCommand,
  type EditorProjectState,
} from './index.js';

const assembly: Assembly = {
  id: assemblyId('assembly'),
  name: 'Wall',
  category: 'WALL',
  layers: [
    {
      id: assemblyLayerId('layer'),
      materialId: materialId('material'),
      thicknessM: 0.2,
    },
  ],
};
const wall: Wall = {
  id: entityId<'Wall'>('wall'),
  type: 'WALL',
  levelId: entityId<'Level'>('level'),
  path: {
    points: [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
    ],
  },
  referenceSide: 'CENTER',
  assemblyId: assembly.id,
  baseOffsetMm: 0,
  heightMode: 'EXPLICIT',
  heightMm: 2500,
  role: 'EXTERIOR',
};
const initial: EditorProjectState = {
  walls: [],
  assemblies: [assembly],
  openings: [],
  dimensions: [],
};

describe('command dispatcher', () => {
  it('executes, undoes and redoes without mutating initial state', () => {
    const dispatcher = new CommandDispatcher(initial);
    expect(dispatcher.dispatch(new AddWallCommand('add', wall)).status).toBe(
      'APPLIED',
    );
    expect(initial.walls).toEqual([]);
    expect(dispatcher.undo().status).toBe('APPLIED');
    expect(dispatcher.state).toEqual(initial);
    expect(dispatcher.redo().status).toBe('APPLIED');
    expect(dispatcher.state.walls).toEqual([wall]);
  });
  it('rejects invalid commands without history changes', () => {
    const dispatcher = new CommandDispatcher(initial);
    expect(
      dispatcher.dispatch(new DeleteWallCommand('delete', wall.id)).status,
    ).toBe('REJECTED');
    expect(dispatcher.state).toBe(initial);
    expect(dispatcher.undo()).toEqual({ status: 'EMPTY_HISTORY' });
  });
  it('applies and reverses an atomic transaction', () => {
    const dispatcher = new CommandDispatcher(initial);
    const transaction = new TransactionCommand('room', 'Create wall', [
      new AddWallCommand('add', wall),
      new MoveWallCommand('move', wall.id, { x: 100, y: 50 }),
    ]);
    expect(dispatcher.dispatch(transaction)).toEqual(
      expect.objectContaining({
        status: 'APPLIED',
        changes: expect.objectContaining({ objectIds: [wall.id] }),
      }),
    );
    expect(dispatcher.state.walls[0]?.path.points[0]).toEqual({
      x: 100,
      y: 50,
    });
    dispatcher.undo();
    expect(dispatcher.state).toEqual(initial);
  });
  it('does not partially apply an invalid transaction', () => {
    const dispatcher = new CommandDispatcher(initial);
    const command = new TransactionCommand('invalid', 'Invalid', [
      new AddWallCommand('add', wall),
      new AddWallCommand('duplicate', wall),
    ]);
    expect(dispatcher.dispatch(command).status).toBe('REJECTED');
    expect(dispatcher.state).toBe(initial);
  });
});
