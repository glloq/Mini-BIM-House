import { describe, expect, it } from 'vitest';
import {
  assemblyId,
  type Assembly,
} from '@house-technical-designer/assemblies';
import { entityId, type Wall } from '@house-technical-designer/core-domain';
import {
  AddDimensionCommand,
  CommandDispatcher,
  MoveWallCommand,
  dimensionId,
  resolveDimension,
  type Dimension,
  type EditorProjectState,
} from './index.js';

const assembly: Assembly = {
  id: assemblyId('assembly'),
  name: 'Wall',
  category: 'WALL',
  layers: [],
};
const first: Wall = {
  id: entityId<'Wall'>('first'),
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
const second: Wall = {
  ...first,
  id: entityId<'Wall'>('second'),
  path: {
    points: [
      { x: 3000, y: 0 },
      { x: 3000, y: 2000 },
    ],
  },
};
const dimension: Dimension = {
  id: dimensionId('distance'),
  kind: 'DIMENSION' as const,
  type: 'HORIZONTAL',
  first: { kind: 'WALL_ENDPOINT', wallId: first.id, endpoint: 'END' },
  second: { kind: 'WALL_ENDPOINT', wallId: second.id, endpoint: 'START' },
  offsetMm: 300,
  overrideText: 'verify on site',
};
const initial: EditorProjectState = {
  walls: [first, second],
  assemblies: [assembly],
  openings: [],
  dimensions: [],
};

describe('associative dimensions', () => {
  it('derives its numeric value independently from override text', () => {
    expect(resolveDimension(dimension, initial.walls)).toMatchObject({
      status: 'OK',
      valueMm: 2000,
    });
  });
  it('updates when referenced geometry moves', () => {
    const dispatcher = new CommandDispatcher(initial);
    dispatcher.dispatch(new AddDimensionCommand('add-dimension', dimension));
    dispatcher.dispatch(
      new MoveWallCommand('move', second.id, { x: 500, y: 0 }),
    );
    expect(
      resolveDimension(dispatcher.state.dimensions[0]!, dispatcher.state.walls),
    ).toMatchObject({ status: 'OK', valueMm: 2500 });
    dispatcher.undo();
    expect(
      resolveDimension(dispatcher.state.dimensions[0]!, dispatcher.state.walls),
    ).toMatchObject({ status: 'OK', valueMm: 2000 });
  });
  it('keeps missing references unknown rather than zero', () => {
    expect(resolveDimension(dimension, [first])).toEqual({
      status: 'UNKNOWN',
      missingWallIds: [second.id],
    });
  });
  it('adds and removes a dimension through undo', () => {
    const dispatcher = new CommandDispatcher(initial);
    expect(
      dispatcher.dispatch(new AddDimensionCommand('add', dimension)).status,
    ).toBe('APPLIED');
    dispatcher.undo();
    expect(dispatcher.state).toEqual(initial);
  });
});
