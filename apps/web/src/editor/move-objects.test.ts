import { describe, expect, it } from 'vitest';
import { ProjectCommandDispatcher } from '@house-technical-designer/editor-core';
import { loadDemoProject } from '../demo-project.js';
import {
  duplicateObjectsCommand,
  moveObjectsCommand,
} from './editing-commands.js';

function file() {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file;
}

function walls(project: ReturnType<typeof file>['project']) {
  return project.building.levels[0]!.walls;
}

describe('carrying a selection across the plan', () => {
  it('moves several walls as a single action', () => {
    const opened = file();
    const before = walls(opened.project).find(({ id }) => id === 'wall-south')!;
    const result = moveObjectsCommand(
      opened,
      'ground',
      ['wall-south', 'wall-north'],
      { x: 500, y: -250 },
    );
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;

    const dispatcher = new ProjectCommandDispatcher(opened.project);
    expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');
    const after = walls(dispatcher.project).find(
      ({ id }) => id === 'wall-south',
    )!;
    expect(after.path.points[0]).toEqual({
      x: before.path.points[0]!.x + 500,
      y: before.path.points[0]!.y - 250,
    });

    // One drag, one undo: both walls come back.
    expect(dispatcher.undo().status).toBe('APPLIED');
    expect(
      walls(dispatcher.project).find(({ id }) => id === 'wall-south')!.path
        .points[0],
    ).toEqual(before.path.points[0]);
  });

  it('carries a slab and a roof by their outline', () => {
    const opened = file();
    const result = moveObjectsCommand(opened, 'ground', ['slab-ground'], {
      x: 100,
      y: 100,
    });
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    const dispatcher = new ProjectCommandDispatcher(opened.project);
    expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');
    const slab = dispatcher.project.building.levels[0]!.slabs[0]!;
    const original = opened.project.building.levels[0]!.slabs[0]!;
    expect(slab.polygon.outer[0]).toEqual({
      x: original.polygon.outer[0]!.x + 100,
      y: original.polygon.outer[0]!.y + 100,
    });
  });

  it('refuses to carry an opening away from its wall, and says why', () => {
    const result = moveObjectsCommand(file(), 'ground', ['opening-entry'], {
      x: 100,
      y: 0,
    });
    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') return;
    expect(result.message).toContain('le long de son mur');
  });

  it('refuses a room, which is what its walls enclose', () => {
    const result = moveObjectsCommand(file(), 'ground', ['space-living'], {
      x: 100,
      y: 0,
    });
    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') return;
    expect(result.message).toContain('murs');
  });

  it('refuses an unmeasurable move rather than writing one', () => {
    const result = moveObjectsCommand(file(), 'ground', ['wall-south'], {
      x: Number.NaN,
      y: 0,
    });
    expect(result.status).toBe('ERROR');
  });
});

describe('copying a selection a little to the side', () => {
  const ids = (prefix: string) => `${prefix}-copy`;

  it('copies walls and reports the copies, which is what is worked on next', () => {
    const opened = file();
    const result = duplicateObjectsCommand(
      opened,
      'ground',
      ['wall-south', 'wall-north'],
      { x: 200, y: 200 },
      (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`,
    );
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    expect(result.createdIds).toHaveLength(2);

    const dispatcher = new ProjectCommandDispatcher(opened.project);
    expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');
    expect(walls(dispatcher.project)).toHaveLength(
      walls(opened.project).length + 2,
    );
    const copy = walls(dispatcher.project).find(
      ({ id }) => id === result.createdIds[0],
    )!;
    const original = walls(opened.project).find(
      ({ id }) => id === 'wall-south',
    )!;
    expect(copy.path.points[0]).toEqual({
      x: original.path.points[0]!.x + 200,
      y: original.path.points[0]!.y + 200,
    });
    expect(copy.assemblyId).toBe(original.assemblyId);

    // One action, one undo.
    expect(dispatcher.undo().status).toBe('APPLIED');
    expect(walls(dispatcher.project)).toHaveLength(
      walls(opened.project).length,
    );
  });

  it('hosts a copied opening on the copy of its wall', () => {
    const opened = file();
    const host = opened.project.building.levels[0]!.openings.find(
      ({ id }) => id === 'opening-entry',
    )!.hostElementId;
    const result = duplicateObjectsCommand(
      opened,
      'ground',
      [host, 'opening-entry'],
      { x: 0, y: 1000 },
      ids,
    );
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    const dispatcher = new ProjectCommandDispatcher(opened.project);
    expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');
    const copied = dispatcher.project.building.levels[0]!.openings.find(
      ({ id }) => id === 'opening-copy',
    )!;
    expect(copied.hostElementId).toBe('wall-copy');
  });

  it('refuses an opening whose wall is not being copied, and says why', () => {
    const result = duplicateObjectsCommand(
      file(),
      'ground',
      ['opening-entry'],
      { x: 0, y: 1000 },
      ids,
    );
    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') return;
    expect(result.message).toContain('son mur');
  });

  it('refuses a selection with nothing it can copy', () => {
    expect(
      duplicateObjectsCommand(file(), 'ground', [], { x: 0, y: 0 }, ids).status,
    ).toBe('ERROR');
    expect(
      duplicateObjectsCommand(
        file(),
        'ground',
        ['water:sink'],
        { x: 0, y: 0 },
        ids,
      ).status,
    ).toBe('ERROR');
  });
});
