import { describe, expect, it } from 'vitest';
import { ProjectCommandDispatcher } from '@house-technical-designer/editor-core';
import { loadDemoProject } from '../demo-project.js';
import {
  alignObjectsCommand,
  joinWallsCommand,
  linesIntersection,
  offsetWallCommand,
} from './editing-commands.js';

function file() {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file;
}

function wallsOf(project: ReturnType<typeof file>['project']) {
  return project.building.levels[0]!.walls;
}

describe('where two wall axes cross', () => {
  it('finds the crossing of two lines', () => {
    expect(
      linesIntersection(
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 500, y: -500 },
        { x: 500, y: 500 },
      ),
    ).toEqual({ x: 500, y: 0 });
  });

  it('says nothing about parallel lines instead of sending a point to infinity', () => {
    expect(
      linesIntersection(
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 0, y: 300 },
        { x: 1000, y: 300 },
      ),
    ).toBeUndefined();
  });
});

describe('drawing a wall parallel to another', () => {
  it('puts it on the side that was pointed at, at that distance', () => {
    const opened = file();
    const south = wallsOf(opened.project).find(
      ({ id }) => id === 'wall-south',
    )!;
    const start = south.path.points[0]!;
    const result = offsetWallCommand(
      opened,
      'ground',
      'wall-south',
      { x: start.x + 1000, y: start.y + 800 },
      'wall-offset',
    );
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    const dispatcher = new ProjectCommandDispatcher(opened.project);
    expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');
    const copy = wallsOf(dispatcher.project).find(
      ({ id }) => id === 'wall-offset',
    )!;
    // Parallel: same length, both ends moved by the same amount.
    expect(copy.path.points[0]!.y - start.y).toBeCloseTo(
      copy.path.points[1]!.y - south.path.points[1]!.y,
      6,
    );
    expect(copy.assemblyId).toBe(south.assemblyId);
  });

  it('asks which side rather than guessing when the click is on the wall', () => {
    const opened = file();
    const south = wallsOf(opened.project).find(
      ({ id }) => id === 'wall-south',
    )!;
    const result = offsetWallCommand(
      opened,
      'ground',
      'wall-south',
      south.path.points[0]!,
      'wall-offset',
    );
    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') return;
    expect(result.message).toContain('côté');
  });
});

describe('bringing walls together', () => {
  it('sends the near end of each to where their axes cross', () => {
    const opened = file();
    const south = wallsOf(opened.project).find(
      ({ id }) => id === 'wall-south',
    )!;
    const east = wallsOf(opened.project).find(({ id }) => id === 'wall-east')!;
    const result = joinWallsCommand(
      opened,
      'ground',
      { wallId: 'wall-south', at: south.path.points[1]! },
      { wallId: 'wall-east', at: east.path.points[0]! },
      true,
    );
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    const dispatcher = new ProjectCommandDispatcher(opened.project);
    expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');
    const crossing = linesIntersection(
      south.path.points[0]!,
      south.path.points[1]!,
      east.path.points[0]!,
      east.path.points[1]!,
    )!;
    const joined = wallsOf(dispatcher.project).find(
      ({ id }) => id === 'wall-south',
    )!;
    expect(joined.path.points[1]!.x).toBeCloseTo(crossing.x, 6);
    expect(joined.path.points[1]!.y).toBeCloseTo(crossing.y, 6);
  });

  it('moves only the first wall when adjusting to the second', () => {
    const opened = file();
    const east = wallsOf(opened.project).find(({ id }) => id === 'wall-east')!;
    const result = joinWallsCommand(
      opened,
      'ground',
      { wallId: 'wall-south', at: { x: 9000, y: 0 } },
      { wallId: 'wall-east', at: east.path.points[0]! },
      false,
    );
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    const dispatcher = new ProjectCommandDispatcher(opened.project);
    expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');
    expect(
      wallsOf(dispatcher.project).find(({ id }) => id === 'wall-east')!.path
        .points,
    ).toEqual(east.path.points);
  });

  it('refuses two parallel walls, which never meet', () => {
    const result = joinWallsCommand(
      file(),
      'ground',
      { wallId: 'wall-south', at: { x: 0, y: 0 } },
      { wallId: 'wall-north', at: { x: 0, y: 8000 } },
      true,
    );
    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') return;
    expect(result.message).toContain('parallèles');
  });

  it('refuses a wall joined to itself', () => {
    const result = joinWallsCommand(
      file(),
      'ground',
      { wallId: 'wall-south', at: { x: 0, y: 0 } },
      { wallId: 'wall-south', at: { x: 100, y: 0 } },
      true,
    );
    expect(result.status).toBe('ERROR');
  });
});

describe('lining objects up', () => {
  it('brings each object onto the outermost edge without reshaping it', () => {
    const opened = file();
    const before = wallsOf(opened.project);
    const west = before.find(({ id }) => id === 'wall-west')!;
    const partition = before.find(({ id }) => id === 'wall-partition-v')!;
    const result = alignObjectsCommand(
      opened,
      'ground',
      ['wall-west', 'wall-partition-v'],
      'LEFT',
    );
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    const dispatcher = new ProjectCommandDispatcher(opened.project);
    expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');
    const after = wallsOf(dispatcher.project).find(
      ({ id }) => id === 'wall-partition-v',
    )!;
    const leftmost = Math.min(...west.path.points.map(({ x }) => x));
    expect(Math.min(...after.path.points.map(({ x }) => x))).toBeCloseTo(
      leftmost,
      6,
    );
    // Moved, not reshaped: the partition keeps its length.
    const length = (wall: typeof after) =>
      Math.hypot(
        wall.path.points[1]!.x - wall.path.points[0]!.x,
        wall.path.points[1]!.y - wall.path.points[0]!.y,
      );
    expect(length(after)).toBeCloseTo(length(partition), 6);
  });

  it('says so rather than writing an edit when they already line up', () => {
    const result = alignObjectsCommand(
      file(),
      'ground',
      ['wall-south', 'wall-north'],
      'LEFT',
    );
    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') return;
    expect(result.message).toContain('déjà alignés');
  });

  it('asks for at least two objects', () => {
    expect(
      alignObjectsCommand(file(), 'ground', ['wall-south'], 'TOP').status,
    ).toBe('ERROR');
  });
});
