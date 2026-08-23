import { describe, expect, it } from 'vitest';
import {
  ProjectCommandDispatcher,
  SetWallHeightCommand,
} from '@house-technical-designer/editor-core';
import { entityId } from '@house-technical-designer/core-domain';
import { loadDemoProject } from '../demo-project.js';
import {
  addWallRectangleCommand,
  addWallRunCommand,
} from './editing-commands.js';

function file() {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file;
}

const DRAFT = {
  assemblyId: 'generic-wall-block-external-insulation',
  role: 'EXTERIOR',
} as const;

let counter = 0;
const newId = (prefix: string): string => `${prefix}-run-${(counter += 1)}`;

function applied(command: ReturnType<typeof addWallRunCommand>) {
  if (command.status !== 'OK') throw new Error(command.message);
  const project = file().project;
  const dispatcher = new ProjectCommandDispatcher(project);
  const result = dispatcher.dispatch(command.command);
  if (result.status !== 'APPLIED')
    throw new Error(
      result.status === 'REJECTED' ? result.errors.join(' ') : result.status,
    );
  return dispatcher;
}

describe('drawing a run of walls', () => {
  it('makes one wall per side of the run', () => {
    const before = file().project.building.levels[0]!.walls.length;
    const dispatcher = applied(
      addWallRunCommand(
        file(),
        'ground',
        [
          { x: 0, y: 20_000 },
          { x: 4000, y: 20_000 },
          { x: 4000, y: 24_000 },
        ],
        DRAFT,
        { asOneWall: false, closed: false, newId },
      ),
    );
    expect(dispatcher.project.building.levels[0]!.walls).toHaveLength(
      before + 2,
    );
  });

  it('makes one polyline wall when that is what was asked', () => {
    // Both readings of the same run are legitimate; neither is guessable.
    const dispatcher = applied(
      addWallRunCommand(
        file(),
        'ground',
        [
          { x: 0, y: 20_000 },
          { x: 4000, y: 20_000 },
          { x: 4000, y: 24_000 },
        ],
        DRAFT,
        { asOneWall: true, closed: false, newId },
      ),
    );
    const walls = dispatcher.project.building.levels[0]!.walls;
    expect(walls[walls.length - 1]!.path.points).toHaveLength(3);
  });

  it('closes the contour when asked, and not otherwise', () => {
    const closed = applied(
      addWallRunCommand(
        file(),
        'ground',
        [
          { x: 0, y: 20_000 },
          { x: 4000, y: 20_000 },
          { x: 4000, y: 24_000 },
        ],
        DRAFT,
        { asOneWall: false, closed: true, newId },
      ),
    );
    // Three corners closed make three sides, not two.
    expect(closed.project.building.levels[0]!.walls).toHaveLength(
      file().project.building.levels[0]!.walls.length + 3,
    );
  });

  it('reads two clicks at the same place as one corner', () => {
    const result = addWallRunCommand(
      file(),
      'ground',
      [
        { x: 0, y: 20_000 },
        { x: 0, y: 20_000 },
      ],
      DRAFT,
      { asOneWall: false, closed: false, newId },
    );
    // A wall of no length is not what the user drew; it is a click they
    // repeated.
    expect(result.status).toBe('ERROR');
  });

  it('refuses an assembly the project does not hold', () => {
    const result = addWallRunCommand(
      file(),
      'ground',
      [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
      ],
      { assemblyId: 'nowhere', role: 'EXTERIOR' },
      { asOneWall: false, closed: false, newId },
    );
    expect(result.status).toBe('ERROR');
  });

  it('undoes a whole run as one action', () => {
    const before = file().project.building.levels[0]!.walls.length;
    const dispatcher = applied(
      addWallRunCommand(
        file(),
        'ground',
        [
          { x: 0, y: 20_000 },
          { x: 4000, y: 20_000 },
          { x: 4000, y: 24_000 },
        ],
        DRAFT,
        { asOneWall: false, closed: false, newId },
      ),
    );
    expect(dispatcher.undo().status).toBe('APPLIED');
    expect(dispatcher.project.building.levels[0]!.walls).toHaveLength(before);
  });
});

describe('enclosing by two opposite corners', () => {
  it('builds four walls at right angles', () => {
    const before = file().project.building.levels[0]!.walls.length;
    const dispatcher = applied(
      addWallRectangleCommand(
        file(),
        'ground',
        [
          { x: 0, y: 20_000 },
          { x: 6000, y: 24_000 },
        ],
        DRAFT,
        newId,
      ),
    );
    const walls = dispatcher.project.building.levels[0]!.walls;
    expect(walls).toHaveLength(before + 4);
    // Each side is horizontal or vertical: the corners are square whatever the
    // two clicks were.
    for (const wall of walls.slice(before)) {
      const [start, end] = wall.path.points;
      expect(start!.x === end!.x || start!.y === end!.y).toBe(true);
    }
  });

  it('refuses two corners that enclose nothing', () => {
    const result = addWallRectangleCommand(
      file(),
      'ground',
      [
        { x: 0, y: 0 },
        { x: 0, y: 4000 },
      ],
      DRAFT,
      newId,
    );
    expect(result.status).toBe('ERROR');
  });
});

/** The reference house with a storey above, which it does not have. */
function twoStoreys() {
  const project = file().project;
  const ground = project.building.levels[0]!;
  return {
    ...project,
    building: {
      ...project.building,
      levels: [
        ground,
        {
          ...ground,
          id: entityId<'Level'>('upper'),
          name: 'Étage',
          elevationMm: 2700,
          walls: [],
          slabs: [],
          roofs: [],
          openings: [],
          spaces: [],
          annotations: [],
        },
      ],
    },
  };
}

describe('how high a wall stands', () => {
  it('sends a wall up to a storey above and drops its own height', () => {
    const dispatcher = new ProjectCommandDispatcher(twoStoreys());
    const result = dispatcher.dispatch(
      new SetWallHeightCommand('ground', 'wall-south', {
        mode: 'TO_LEVEL',
        topLevelId: 'upper',
        topOffsetMm: -200,
      }),
    );
    expect(result.status).toBe('APPLIED');
    const wall = dispatcher.project.building.levels[0]!.walls.find(
      ({ id }) => id === 'wall-south',
    )!;
    expect(wall.heightMode).toBe('TO_LEVEL');
    // A height left behind on a wall reaching a level is a number nobody reads
    // and nothing keeps true.
    expect((wall as { heightMm?: number }).heightMm).toBeUndefined();
  });

  it('refuses a storey that is not above the wall', () => {
    const dispatcher = new ProjectCommandDispatcher(twoStoreys());
    const result = dispatcher.dispatch(
      new SetWallHeightCommand('ground', 'wall-south', {
        mode: 'TO_LEVEL',
        topLevelId: 'ground',
      }),
    );
    expect(result.status).toBe('REJECTED');
  });

  it('refuses a storey the project does not hold', () => {
    const dispatcher = new ProjectCommandDispatcher(file().project);
    expect(
      dispatcher.dispatch(
        new SetWallHeightCommand('ground', 'wall-south', {
          mode: 'TO_LEVEL',
          topLevelId: 'nowhere',
        }),
      ).status,
    ).toBe('REJECTED');
  });

  it('brings a wall back to a height of its own', () => {
    const dispatcher = new ProjectCommandDispatcher(twoStoreys());
    dispatcher.dispatch(
      new SetWallHeightCommand('ground', 'wall-south', {
        mode: 'TO_LEVEL',
        topLevelId: 'upper',
      }),
    );
    dispatcher.dispatch(
      new SetWallHeightCommand('ground', 'wall-south', {
        mode: 'EXPLICIT',
        heightMm: 2400,
      }),
    );
    const wall = dispatcher.project.building.levels[0]!.walls.find(
      ({ id }) => id === 'wall-south',
    )!;
    expect(wall.heightMode).toBe('EXPLICIT');
    expect((wall as { topLevelId?: string }).topLevelId).toBeUndefined();
  });
});
