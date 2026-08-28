import { describe, expect, it } from 'vitest';
import {
  assemblyId,
  type Assembly,
} from '@house-technical-designer/assemblies';
import {
  entityId,
  type WallOpening,
  type Wall,
} from '@house-technical-designer/core-domain';
import {
  CommandDispatcher,
  DeleteWallCommand,
  createOpeningInsertionCommand,
  type EditorProjectState,
} from './index.js';

const assembly: Assembly = {
  id: assemblyId('assembly'),
  name: 'Wall',
  category: 'WALL',
  layers: [],
};
const wall: Wall = {
  id: entityId<'Wall'>('wall'),
  type: 'WALL',
  levelId: entityId<'Level'>('level'),
  path: {
    points: [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
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
  walls: [wall],
  assemblies: [assembly],
  openings: [],
  dimensions: [],
};

const createOpening = (placement: {
  host: Wall;
  offsetAlongHostMm: number;
}): WallOpening => ({
  id: entityId<'Opening'>('opening'),
  type: 'OPENING',
  openingType: 'WINDOW',
  host: { kind: 'WALL', id: placement.host.id },
  offsetAlongHostMm: placement.offsetAlongHostMm,
  sillHeightMm: 900,
  widthMm: 1000,
  heightMm: 1000,
});

describe('opening insertion tool', () => {
  it('projects an insertion point into host-local coordinates', () => {
    const command = createOpeningInsertionCommand({ x: 1200, y: 50 }, [wall], {
      maximumHostDistanceMm: 100,
      commandId: () => 'insert',
      createOpening,
    });
    expect(command?.opening).toMatchObject({
      host: { kind: 'WALL', id: wall.id },
      offsetAlongHostMm: 1200,
    });
  });
  it('does not insert when no host is close enough', () => {
    expect(
      createOpeningInsertionCommand({ x: 1200, y: 500 }, [wall], {
        maximumHostDistanceMm: 100,
        commandId: () => 'insert',
        createOpening,
      }),
    ).toBeUndefined();
  });
  it('produces a reversible opening command', () => {
    const command = createOpeningInsertionCommand({ x: 1200, y: 0 }, [wall], {
      maximumHostDistanceMm: 100,
      commandId: () => 'insert',
      createOpening,
    })!;
    const dispatcher = new CommandDispatcher(initial);
    expect(dispatcher.dispatch(command).status).toBe('APPLIED');
    expect(dispatcher.state.openings).toHaveLength(1);
    dispatcher.undo();
    expect(dispatcher.state).toEqual(initial);
  });
  it('prevents deleting a wall while it hosts an opening', () => {
    const command = createOpeningInsertionCommand({ x: 1200, y: 0 }, [wall], {
      maximumHostDistanceMm: 100,
      commandId: () => 'insert',
      createOpening,
    })!;
    const dispatcher = new CommandDispatcher(initial);
    dispatcher.dispatch(command);
    expect(
      dispatcher.dispatch(new DeleteWallCommand('delete-wall', wall.id)).status,
    ).toBe('REJECTED');
  });
});
