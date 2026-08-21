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

/** The reference house with a storey above, which it does not have. */
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
});

describe('building a stair from the plan', () => {
  it('sends it to the storey just above', () => {
    const stairs = built().project.building.levels[0]!.stairs;
    expect(stairs).toHaveLength(1);
    expect(stairs[0]!.topLevelId).toBe('upper');
  });

  it('refuses to build one where nothing stands above', () => {
    // The reference house has one storey; a stair there would arrive nowhere.
    const result = addStairCommand(file(), 'ground', WALK, DRAFT, 'stair-main');
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
    expect(boundsOf(project, 'ground', 'stair-main')).toEqual({
      min: { x: 1000, y: 1000 },
      max: { x: 5000, y: 1000 },
    });
    expect(relationshipsOf(project, 'ground', 'stair-main')).toEqual([
      { role: 'Niveau d’arrivée', objectIds: ['upper'] },
    ]);
    expect(removalCommandFor(project, 'ground', 'stair-main')).toBeDefined();
  });
});
