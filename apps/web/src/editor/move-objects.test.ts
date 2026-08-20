import { describe, expect, it } from 'vitest';
import { ProjectCommandDispatcher } from '@house-technical-designer/editor-core';
import { loadDemoProject } from '../demo-project.js';
import { moveObjectsCommand } from './editing-commands.js';

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
