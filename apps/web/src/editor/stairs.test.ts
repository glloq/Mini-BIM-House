import { describe, expect, it } from 'vitest';
import {
  ProjectCommandDispatcher,
  UpdateStairCommand,
} from '@house-technical-designer/editor-core';
import {
  entityId,
  stairDimensions,
} from '@house-technical-designer/core-domain';
import type { Stair } from '@house-technical-designer/core-domain';
import { loadDemoProject } from '../demo-project.js';
import { addStairCommand } from './editing-commands.js';
import {
  boundsOf,
  editsFor,
  familyOf,
  inspectObject,
  relationshipsOf,
  removalCommandFor,
} from './object-editors.js';

function file() {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file;
}

/** Two bare storeys, so what this suite builds is the only stair there is. */
function twoStoreys() {
  const source = file();
  const ground = source.project.building.levels[0]!;
  return {
    ...source,
    project: {
      ...source.project,
      building: {
        ...source.project.building,
        levels: [
          { ...ground, stairs: [] },
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
            stairs: [],
          },
        ],
      },
    },
  };
}

const WALK = [
  { x: 1000, y: 1000 },
  { x: 5000, y: 1000 },
];

const DRAFT = {
  stairType: 'STRAIGHT',
  widthMm: 900,
  riserCount: 16,
  treadDepthMm: 270,
} as const;

function built(project = twoStoreys()) {
  const result = addStairCommand(project, 'ground', WALK, DRAFT, 'stair-main');
  if (result.status !== 'OK') throw new Error(result.message);
  const dispatcher = new ProjectCommandDispatcher(project.project);
  const applied = dispatcher.dispatch(result.command);
  if (applied.status !== 'APPLIED')
    throw new Error(
      applied.status === 'REJECTED' ? applied.errors.join(' ') : applied.status,
    );
  return dispatcher;
}

describe('what a stair measures', () => {
  const stair: Stair = {
    id: entityId<'Stair'>('stair'),
    type: 'STAIR',
    levelId: entityId<'Level'>('ground'),
    topLevelId: entityId<'Level'>('upper'),
    stairType: 'STRAIGHT',
    widthMm: 900,
    riserCount: 16,
    treadDepthMm: 270,
    path: { points: WALK },
  };

  it('derives the riser height from the storeys it joins', () => {
    // Nothing is stored: a riser height written down would disagree with the
    // storeys the first time one of them moved.
    expect(stairDimensions(stair, 2720).riserHeightMm).toBe(170);
  });

  it('counts one fewer tread than riser', () => {
    // The last riser arrives on the storey above, which is not a tread.
    expect(stairDimensions(stair, 2720).runMm).toBe(15 * 270);
  });

  it('adds the landings to the length on the ground', () => {
    expect(
      stairDimensions(
        { ...stair, landings: [{ afterRiser: 8, depthMm: 900 }] },
        2720,
      ).runMm,
    ).toBe(15 * 270 + 900);
  });

  it('reports the comfort rule rather than correcting it', () => {
    const { blondelMm } = stairDimensions(stair, 2720);
    expect(blondelMm).toBe(2 * 170 + 270);
  });

  it('measures the line that is drawn beside the flight it carries', () => {
    // The drawn line is 4000 mm; fifteen treads of 270 need 4050. The two are
    // two answers to the same question and the stair states both.
    const measured = stairDimensions(stair, 2720);
    expect(measured.pathLengthMm).toBe(4000);
    expect(measured.runMm).toBe(4050);
    expect(measured.pathDifferenceMm).toBe(-50);
    expect(measured.pathMatchesRun).toBe(false);
  });

  it('calls a line that carries its flight to the millimetre a match', () => {
    const fitted: Stair = {
      ...stair,
      path: {
        points: [
          { x: 1000, y: 1000 },
          { x: 1000 + 15 * 270, y: 1000 },
        ],
      },
    };
    const measured = stairDimensions(fitted, 2720);
    expect(measured.pathDifferenceMm).toBe(0);
    expect(measured.pathMatchesRun).toBe(true);
  });

  it('forgives a difference no drawing could hold', () => {
    // Five millimetres over four metres is where the pointer landed, not a
    // stair that does not fit; a centimetre is the line between the two.
    const off: Stair = {
      ...stair,
      path: {
        points: [
          { x: 1000, y: 1000 },
          { x: 1000 + 15 * 270 + 5, y: 1000 },
        ],
      },
    };
    expect(stairDimensions(off, 2720).pathMatchesRun).toBe(true);
    expect(
      stairDimensions(
        {
          ...off,
          path: {
            points: [
              { x: 1000, y: 1000 },
              { x: 1000 + 15 * 270 + 11, y: 1000 },
            ],
          },
        },
        2720,
      ).pathMatchesRun,
    ).toBe(false);
  });
});

describe('building a stair from the plan', () => {
  it('sends it to the storey just above', () => {
    const stairs = built().project.building.levels[0]!.stairs;
    expect(stairs).toHaveLength(1);
    expect(stairs[0]!.topLevelId).toBe('upper');
  });

  it('refuses to build one where nothing stands above', () => {
    // A stair on the top storey of the reference house arrives nowhere.
    const result = addStairCommand(file(), 'first', WALK, DRAFT, 'stair-main');
    expect(result.status).toBe('ERROR');
    if (result.status !== 'ERROR') return;
    expect(result.message).toContain('au-dessus');
  });

  it('refuses fewer than two points of walking line', () => {
    expect(
      addStairCommand(
        twoStoreys(),
        'ground',
        [{ x: 0, y: 0 }],
        DRAFT,
        'stair-short',
      ).status,
    ).toBe('ERROR');
  });

  it('refuses a flight of one riser', () => {
    const dispatcher = built();
    expect(
      dispatcher.dispatch(
        new UpdateStairCommand('ground', 'stair-main', { riserCount: 1 }),
      ).status,
    ).toBe('REJECTED');
  });

  it('refuses a landing that falls outside the flight', () => {
    const dispatcher = built();
    expect(
      dispatcher.dispatch(
        new UpdateStairCommand('ground', 'stair-main', {
          landings: [{ afterRiser: 40, depthMm: 900 }],
        }),
      ).status,
    ).toBe('REJECTED');
  });

  it('fits the drawn line to the flight it has to carry', () => {
    // Fifteen treads of 270 mm need 4050 mm of floor. The user drew 4000, so
    // the line is stretched by fifty: a stair drawn shorter than its own
    // steps would show fewer marches on the plan than the metrés count.
    const stair = built().project.building.levels[0]!.stairs[0]!;
    const measured = stairDimensions(stair, 2700);
    expect(measured.pathLengthMm).toBeCloseTo(4050, 6);
    expect(measured.pathMatchesRun).toBe(true);
    expect(stair.path.points[1]).toEqual({ x: 5050, y: 1000 });
  });

  it('keeps every turn of the line it was given', () => {
    // An L-shaped flight is drawn in two stretches; fitting moves the end,
    // never the corner the user placed.
    const result = addStairCommand(
      twoStoreys(),
      'ground',
      [
        { x: 0, y: 0 },
        { x: 2000, y: 0 },
        { x: 2000, y: 1000 },
      ],
      DRAFT,
      'stair-l',
    );
    if (result.status !== 'OK') throw new Error(result.message);
    const dispatcher = new ProjectCommandDispatcher(twoStoreys().project);
    dispatcher.dispatch(result.command);
    const points =
      dispatcher.project.building.levels[0]!.stairs[0]!.path.points;
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[1]).toEqual({ x: 2000, y: 0 });
    expect(points[2]).toEqual({ x: 2000, y: 2050 });
  });

  it('refuses to arrive at a storey that is not above', () => {
    const dispatcher = built();
    expect(
      dispatcher.dispatch(
        new UpdateStairCommand('ground', 'stair-main', {
          topLevelId: 'ground',
        }),
      ).status,
    ).toBe('REJECTED');
  });
});

describe('a stair as an object of the editor', () => {
  it('belongs to a family of its own', () => {
    const project = built().project;
    expect(familyOf(project, 'stair-main')?.label).toBe('Escalier');
    expect(inspectObject(project, 'stair-main').kind).toBe('STAIR');
  });

  it('shows the riser height it derives, and says where it comes from', () => {
    const fields = inspectObject(
      built().project,
      'stair-main',
    ).sections.flatMap(({ fields: rows }) => rows);
    const riser = fields.find(({ label }) => label === 'Hauteur de marche')!;
    expect(riser.value).toBe('168.8 mm');
    expect(riser.hint).toContain('Déduite');
  });

  it('never offers the riser height for editing', () => {
    const ids = editsFor(built().project, 'stair-main').map(({ id }) => id);
    expect(ids).toContain('riserCount');
    expect(ids).toContain('treadDepthMm');
    expect(ids).not.toContain('riserHeightMm');
  });

  it('can be measured, named and taken back off the plan', () => {
    const project = built().project;
    // 5050 and not the 5000 that was drawn: fifteen treads of 270 mm need
    // 4050 mm of floor, and the line was fitted to them.
    expect(boundsOf(project, 'ground', 'stair-main')).toEqual({
      min: { x: 1000, y: 1000 },
      max: { x: 5050, y: 1000 },
    });
    expect(relationshipsOf(project, 'ground', 'stair-main')).toEqual([
      { role: 'Niveau d’arrivée', objectIds: ['upper'] },
    ]);
    expect(removalCommandFor(project, 'ground', 'stair-main')).toBeDefined();
  });
});
