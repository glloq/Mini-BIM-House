import { describe, expect, it } from 'vitest';
import {
  ProjectCommandDispatcher,
  detectRooms,
} from '@house-technical-designer/editor-core';
import { loadDemoProject } from '../demo-project.js';
import {
  addEveryDetectedRoomCommand,
  addSlabFromPointsCommand,
  addSpaceAtPointCommand,
  addWallCommand,
  addWallRectangleCommand,
  mergeSpacesCommand,
  pointInPolygon,
  punchSlabHoleCommand,
} from './editing-commands.js';

function file() {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file;
}

/** The reference house without the rooms it already holds. */
function roomless() {
  const source = file();
  const ground = source.project.building.levels[0]!;
  return {
    ...source,
    project: {
      ...source.project,
      building: {
        ...source.project.building,
        levels: [{ ...ground, spaces: [] }],
        // The heated zone names rooms that are no longer there.
        zones: [],
      },
    },
  };
}

let counter = 0;
const newId = (prefix: string): string => `${prefix}-made-${(counter += 1)}`;

function applied(
  project: ReturnType<typeof file>['project'],
  result: ReturnType<typeof addSpaceAtPointCommand>,
) {
  if (result.status !== 'OK') throw new Error(result.message);
  const dispatcher = new ProjectCommandDispatcher(project);
  const outcome = dispatcher.dispatch(result.command);
  if (outcome.status !== 'APPLIED')
    throw new Error(
      outcome.status === 'REJECTED' ? outcome.errors.join(' ') : outcome.status,
    );
  return dispatcher;
}

describe('being inside a contour', () => {
  it('tells a point inside from a point outside', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(pointInPolygon({ x: 50, y: 50 }, square)).toBe(true);
    expect(pointInPolygon({ x: 150, y: 50 }, square)).toBe(false);
  });
});

describe('making a room from the walls that enclose it', () => {
  it('creates the room the point falls in', () => {
    const project = roomless().project;
    const dispatcher = applied(
      project,
      addSpaceAtPointCommand(
        roomless(),
        'ground',
        { x: 2500, y: 2000 },
        { name: 'Séjour', category: 'LIVING' },
        newId('space'),
      ),
    );
    const spaces = dispatcher.project.building.levels[0]!.spaces;
    expect(spaces).toHaveLength(1);
    expect(spaces[0]!.name).toBe('Séjour');
    // The outline is the one the walls already describe, not one redrawn by
    // hand a few millimetres off.
    expect(
      spaces[0]!.boundaryMode === 'MANUAL' &&
        spaces[0]!.manualPolygon.outer.length >= 4,
    ).toBe(true);
  });

  it('refuses a point no wall encloses', () => {
    const result = addSpaceAtPointCommand(
      roomless(),
      'ground',
      { x: 90_000, y: 90_000 },
      { name: 'Nulle part', category: 'OTHER' },
      newId('space'),
    );
    expect(result.status).toBe('ERROR');
  });

  it('refuses a contour that already carries a room', () => {
    // The reference house names its rooms; creating a second one over the
    // first would leave two rooms nothing distinguishes.
    const result = addSpaceAtPointCommand(
      file(),
      'ground',
      { x: 2500, y: 2000 },
      { name: 'Doublon', category: 'OTHER' },
      newId('space'),
    );
    expect(result.status).toBe('ERROR');
  });

  it('creates every free contour in one action', () => {
    const dispatcher = applied(
      roomless().project,
      addEveryDetectedRoomCommand(
        roomless(),
        'ground',
        { category: 'OTHER' },
        newId,
      ),
    );
    const spaces = dispatcher.project.building.levels[0]!.spaces;
    expect(spaces.length).toBeGreaterThan(1);
    // One action, one undo.
    expect(dispatcher.undo().status).toBe('APPLIED');
    expect(dispatcher.project.building.levels[0]!.spaces).toHaveLength(0);
  });

  it('says so rather than doing nothing when every contour is taken', () => {
    expect(
      addEveryDetectedRoomCommand(
        file(),
        'ground',
        { category: 'OTHER' },
        newId,
      ).status,
    ).toBe('ERROR');
  });
});

describe('laying a slab', () => {
  it('builds one on the points that were clicked', () => {
    const dispatcher = applied(
      file().project,
      addSlabFromPointsCommand(
        file(),
        'ground',
        [
          { x: 0, y: 20_000 },
          { x: 4000, y: 20_000 },
          { x: 4000, y: 24_000 },
        ],
        {
          assemblyId: 'generic-floor-slab-on-ground',
          role: 'TERRACE',
          fromRoom: false,
        },
        newId('slab'),
      ),
    );
    expect(dispatcher.project.building.levels[0]!.slabs).toHaveLength(2);
  });

  it('builds one on the contour the walls already describe', () => {
    const dispatcher = applied(
      file().project,
      addSlabFromPointsCommand(
        file(),
        'ground',
        [{ x: 2500, y: 2000 }],
        {
          assemblyId: 'generic-floor-slab-on-ground',
          role: 'FLOOR',
          fromRoom: true,
        },
        newId('slab'),
      ),
    );
    const slabs = dispatcher.project.building.levels[0]!.slabs;
    expect(slabs[slabs.length - 1]!.polygon.outer.length).toBeGreaterThan(3);
  });

  it('refuses fewer than three corners', () => {
    expect(
      addSlabFromPointsCommand(
        file(),
        'ground',
        [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
        ],
        {
          assemblyId: 'generic-floor-slab-on-ground',
          role: 'FLOOR',
          fromRoom: false,
        },
        newId('slab'),
      ).status,
    ).toBe('ERROR');
  });
});

describe('cutting a stairwell through a floor', () => {
  it('puts the hole in the slab that passes under it', () => {
    const dispatcher = applied(
      file().project,
      punchSlabHoleCommand(file(), 'ground', [
        { x: 2000, y: 2000 },
        { x: 3000, y: 2000 },
        { x: 3000, y: 3000 },
        { x: 2000, y: 3000 },
      ]),
    );
    const slab = dispatcher.project.building.levels[0]!.slabs[0]!;
    expect(slab.polygon.holes).toHaveLength(1);
    // A hole belongs to its slab and moves with it; it is not a second slab.
    expect(dispatcher.project.building.levels[0]!.slabs).toHaveLength(1);
  });

  it('refuses a contour that leaves the slab', () => {
    expect(
      punchSlabHoleCommand(file(), 'ground', [
        { x: 2000, y: 2000 },
        { x: 90_000, y: 2000 },
        { x: 90_000, y: 3000 },
      ]).status,
    ).toBe('ERROR');
  });

  it('refuses a contour with no slab under it', () => {
    expect(
      punchSlabHoleCommand(file(), 'ground', [
        { x: 80_000, y: 80_000 },
        { x: 81_000, y: 80_000 },
        { x: 81_000, y: 81_000 },
      ]).status,
    ).toBe('ERROR');
  });
});

describe('reuniting two rooms', () => {
  /*
   * Deux pièces sont séparées par ce qui les sépare.
   *
   * Les réunir n'est donc pas une opération sur les pièces : c'est retirer la
   * cloison, après quoi les murs n'enferment plus qu'un contour, et ce contour
   * n'a besoin que d'une pièce. Le contour d'arrivée est relu du modèle plutôt
   * que calculé — le modèle sait déjà répondre.
   */
  function splitHouse() {
    const source = file();
    const ground = source.project.building.levels[0]!;
    const project = { ...source.project };
    const dispatcher = new ProjectCommandDispatcher(project);
    const rooms = detectRooms(project, ground.id);
    return { dispatcher, rooms, levelId: ground.id };
  }

  /** Un rectangle coupé en deux par une cloison, et ses deux pièces. */
  function twoRooms() {
    const source = file();
    const ground = source.project.building.levels[0]!;
    const blank = {
      ...source,
      project: {
        ...source.project,
        building: {
          ...source.project.building,
          levels: [
            { ...ground, walls: [], openings: [], spaces: [], slabs: [] },
          ],
          zones: [],
        },
      },
    };
    const wallAssembly = (blank.project.assemblies ?? []).find(
      ({ category }) => category === 'WALL',
    )!.id;
    const dispatcher = new ProjectCommandDispatcher(blank.project);
    const push = (result: ReturnType<typeof addSpaceAtPointCommand>) => {
      if (result.status !== 'OK') throw new Error(result.message);
      const outcome = dispatcher.dispatch(result.command);
      if (outcome.status !== 'APPLIED')
        throw new Error(
          outcome.status === 'REJECTED'
            ? outcome.errors.join(' ')
            : outcome.status,
        );
    };
    const at = (project: typeof dispatcher.project) => ({
      ...blank,
      project,
    });
    push(
      addWallRectangleCommand(
        blank,
        ground.id,
        [
          { x: 0, y: 0 },
          { x: 10_000, y: 6_000 },
        ],
        { assemblyId: wallAssembly, role: 'EXTERIOR' },
        newId,
      ),
    );
    push(
      addWallCommand(
        at(dispatcher.project),
        ground.id,
        [
          { x: 5_000, y: 0 },
          { x: 5_000, y: 6_000 },
        ],
        { assemblyId: wallAssembly, role: 'PARTITION' },
        newId('wall'),
      ),
    );
    push(
      addSpaceAtPointCommand(
        at(dispatcher.project),
        ground.id,
        { x: 2_500, y: 3_000 },
        { name: 'Séjour', category: 'LIVING' },
        newId('space'),
      ),
    );
    push(
      addSpaceAtPointCommand(
        at(dispatcher.project),
        ground.id,
        { x: 7_500, y: 3_000 },
        { name: 'Cuisine', category: 'KITCHEN' },
        newId('space'),
      ),
    );
    return { file: at(dispatcher.project), levelId: ground.id };
  }

  it('takes the partition away and leaves one room where there were two', () => {
    const { file: house, levelId } = twoRooms();
    expect(house.project.building.levels[0]!.spaces).toHaveLength(2);
    const walls = house.project.building.levels[0]!.walls.length;

    const result = mergeSpacesCommand(
      house,
      levelId,
      { x: 2_500, y: 3_000 },
      { x: 7_500, y: 3_000 },
      'space-merged',
    );
    if (result.status !== 'OK') throw new Error(result.message);
    const dispatcher = new ProjectCommandDispatcher(house.project);
    const outcome = dispatcher.dispatch(result.command);
    expect(outcome.status).toBe('APPLIED');

    const level = dispatcher.project.building.levels[0]!;
    // Une seule pièce, un mur de moins, et le nom de celle qu'on a montrée en
    // premier : un nom inventé serait un nom que personne n'a choisi.
    expect(level.spaces).toHaveLength(1);
    expect(level.walls).toHaveLength(walls - 1);
    expect(level.spaces[0]!.name).toBe('Séjour');
    // Et le contour est celui que les murs enferment maintenant, relu du
    // modèle plutôt que calculé.
    expect(detectRooms(dispatcher.project, levelId)).toHaveLength(1);
  });

  it('refuses two points that are the same room', () => {
    const { dispatcher, rooms, levelId } = splitHouse();
    const inside = rooms[0]!.polygon.outer[0]!;
    const result = mergeSpacesCommand(
      { ...file(), project: dispatcher.project },
      levelId,
      { x: inside.x + 500, y: inside.y + 500 },
      { x: inside.x + 600, y: inside.y + 600 },
      'space-merged',
    );
    expect(result.status).toBe('ERROR');
  });

  it('refuses two rooms that share no wall', () => {
    // Sans mur commun il n'y a rien à retirer, et fusionner voudrait dire
    // inventer un contour que les murs ne décrivent pas.
    const { dispatcher, levelId } = splitHouse();
    const result = mergeSpacesCommand(
      { ...file(), project: dispatcher.project },
      levelId,
      { x: -900_000, y: -900_000 },
      { x: 900_000, y: 900_000 },
      'space-merged',
    );
    expect(result.status).toBe('ERROR');
  });
});
