import { describe, expect, it } from 'vitest';
import { ProjectCommandDispatcher } from '@house-technical-designer/editor-core';
import { loadDemoProject } from '../demo-project.js';
import { transformObjectsCommand, transformPoint } from './editing-commands.js';

function file() {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file;
}

const round = (value: number): number => Math.round(value * 100) / 100;

describe('the map a transform applies to a point', () => {
  it('turns a point around a centre', () => {
    const turned = transformPoint(
      { kind: 'ROTATE', centre: { x: 0, y: 0 }, angleDeg: 90 },
      { x: 1000, y: 0 },
    );
    expect({ x: round(turned.x), y: round(turned.y) }).toEqual({
      x: 0,
      y: 1000,
    });
  });

  it('leaves the centre of a rotation where it is', () => {
    const centre = { x: 500, y: 500 };
    expect(
      transformPoint({ kind: 'ROTATE', centre, angleDeg: 37 }, centre),
    ).toEqual(centre);
  });

  it('reflects a point across an axis', () => {
    const reflected = transformPoint(
      { kind: 'MIRROR', from: { x: 0, y: 0 }, to: { x: 0, y: 1000 } },
      { x: 300, y: 700 },
    );
    expect(reflected).toEqual({ x: -300, y: 700 });
  });

  it('leaves a point on the axis where it is', () => {
    expect(
      transformPoint(
        { kind: 'MIRROR', from: { x: 0, y: 0 }, to: { x: 1000, y: 0 } },
        { x: 400, y: 0 },
      ),
    ).toEqual({ x: 400, y: 0 });
  });

  it('does not divide by an axis of no length', () => {
    const point = { x: 12, y: 34 };
    expect(
      transformPoint(
        { kind: 'MIRROR', from: { x: 5, y: 5 }, to: { x: 5, y: 5 } },
        point,
      ),
    ).toEqual(point);
  });
});

describe('turning and reflecting a selection', () => {
  it('turns a wall in one step, keeping its length', () => {
    const opened = file();
    const before = opened.project.building.levels[0]!.walls.find(
      ({ id }) => id === 'wall-south',
    )!;
    const length = Math.hypot(
      before.path.points[1]!.x - before.path.points[0]!.x,
      before.path.points[1]!.y - before.path.points[0]!.y,
    );
    const result = transformObjectsCommand(opened, 'ground', ['wall-south'], {
      kind: 'ROTATE',
      centre: before.path.points[0]!,
      angleDeg: 90,
    });
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    const dispatcher = new ProjectCommandDispatcher(opened.project);
    expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');
    const after = dispatcher.project.building.levels[0]!.walls.find(
      ({ id }) => id === 'wall-south',
    )!;
    expect(
      round(
        Math.hypot(
          after.path.points[1]!.x - after.path.points[0]!.x,
          after.path.points[1]!.y - after.path.points[0]!.y,
        ),
      ),
    ).toBe(round(length));
    // The wall carries its openings: a quarter turn cannot leave one hanging.
    expect(dispatcher.undo().status).toBe('APPLIED');
  });

  it('reflects a slab outline', () => {
    const opened = file();
    const original = opened.project.building.levels[0]!.slabs[0]!;
    const result = transformObjectsCommand(opened, 'ground', ['slab-ground'], {
      kind: 'MIRROR',
      from: { x: 0, y: 0 },
      to: { x: 0, y: 1000 },
    });
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    const dispatcher = new ProjectCommandDispatcher(opened.project);
    expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');
    // A vertex away from the axis, so the reflection is visible in it.
    expect(
      dispatcher.project.building.levels[0]!.slabs[0]!.polygon.outer[1],
    ).toEqual({
      x: -original.polygon.outer[1]!.x,
      y: original.polygon.outer[1]!.y,
    });
  });

  it('refuses an opening on its own, which follows its wall', () => {
    const result = transformObjectsCommand(
      file(),
      'ground',
      ['opening-entry'],
      { kind: 'ROTATE', centre: { x: 0, y: 0 }, angleDeg: 90 },
    );
    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') return;
    expect(result.message).toContain('suit son mur');
  });

  it('refuses an angle that is not a number', () => {
    expect(
      transformObjectsCommand(file(), 'ground', ['wall-south'], {
        kind: 'ROTATE',
        centre: { x: 0, y: 0 },
        angleDeg: Number.NaN,
      }).status,
    ).toBe('ERROR');
  });
});
