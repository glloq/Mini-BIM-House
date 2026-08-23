import { describe, expect, it } from 'vitest';
import { assemblyId } from '@house-technical-designer/assemblies';
import { entityId } from './ids.js';
import {
  DEFAULT_DOOR_SWING,
  calculateWallNetArea,
  doorSwingOf,
  validateOpening,
  type Opening,
} from './opening.js';
import type { Wall } from './wall.js';

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
  assemblyId: assemblyId('assembly'),
  baseOffsetMm: 0,
  heightMode: 'EXPLICIT',
  heightMm: 2500,
  role: 'EXTERIOR',
};
const opening: Opening = {
  id: entityId<'Opening'>('window'),
  type: 'OPENING',
  openingType: 'WINDOW',
  hostElementId: wall.id,
  offsetAlongHostMm: 1000,
  sillHeightMm: 900,
  widthMm: 1200,
  heightMm: 1000,
};

describe('hosted openings', () => {
  it('deducts opening area from gross wall area', () => {
    expect(calculateWallNetArea(wall, [opening])).toEqual({
      status: 'OK',
      grossAreaMm2: 10_000_000,
      openingAreaMm2: 1_200_000,
      netAreaMm2: 8_800_000,
    });
  });
  it('rejects dimensions outside the host rather than clipping silently', () => {
    expect(
      validateOpening({ ...opening, offsetAlongHostMm: 3500 }, wall),
    ).toContainEqual(expect.objectContaining({ code: 'OUTSIDE_HOST' }));
    expect(
      validateOpening({ ...opening, sillHeightMm: 2000 }, wall),
    ).toContainEqual(expect.objectContaining({ code: 'OUTSIDE_HOST' }));
  });
  it('preserves unknown height when a wall is constrained to another level', () => {
    const toLevel: Wall = {
      ...wall,
      heightMode: 'TO_LEVEL',
      topLevelId: entityId<'Level'>('upper'),
    };
    expect(calculateWallNetArea(toLevel, [opening])).toEqual({
      status: 'UNKNOWN',
      reason: 'WALL_HEIGHT_REQUIRES_LEVELS',
    });
  });
  it('reports a mismatched host', () => {
    expect(
      validateOpening(
        { ...opening, hostElementId: entityId<'Wall'>('other') },
        wall,
      ),
    ).toContainEqual(expect.objectContaining({ code: 'WRONG_HOST' }));
  });
  it('rejects overlapping opening rectangles before area deduction', () => {
    const overlapping = {
      ...opening,
      id: entityId<'Opening'>('window-2'),
      offsetAlongHostMm: 1500,
    };
    expect(calculateWallNetArea(wall, [opening, overlapping])).toEqual(
      expect.objectContaining({
        status: 'INVALID',
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'OVERLAPPING_OPENINGS' }),
        ]),
      }),
    );
  });
});

describe('which way a door opens', () => {
  const door: Opening = { ...opening, openingType: 'DOOR', sillHeightMm: 0 };

  it('gives a door that says nothing the swing every door had', () => {
    // A file written before a door could be asked opens unchanged.
    expect(doorSwingOf(door)).toEqual({
      hinge: 'START',
      opensTo: 'RIGHT_OF_HOST',
      openingAngleDeg: 90,
    });
    expect(DEFAULT_DOOR_SWING.hinge).toBe('START');
  });

  it('keeps a right angle when only the hinge and the side are stated', () => {
    expect(
      doorSwingOf({
        ...door,
        swing: { hinge: 'END', opensTo: 'LEFT_OF_HOST' },
      }),
    ).toEqual({ hinge: 'END', opensTo: 'LEFT_OF_HOST', openingAngleDeg: 90 });
  });

  it('refuses a swing it could not draw', () => {
    expect(
      validateOpening(
        {
          ...door,
          swing: { hinge: 'MIDDLE' as never, opensTo: 'RIGHT_OF_HOST' },
        },
        wall,
      ),
    ).toContainEqual(expect.objectContaining({ code: 'INVALID_SWING' }));
    expect(
      validateOpening(
        {
          ...door,
          swing: {
            hinge: 'START',
            opensTo: 'RIGHT_OF_HOST',
            openingAngleDeg: 400,
          },
        },
        wall,
      ),
    ).toContainEqual(
      expect.objectContaining({ path: 'swing.openingAngleDeg' }),
    );
  });

  it('refuses a swing on something that is not a door', () => {
    // A window does not swing on a plan, and a hole in a wall does not either.
    expect(
      validateOpening(
        { ...opening, swing: { hinge: 'START', opensTo: 'LEFT_OF_HOST' } },
        wall,
      ),
    ).toContainEqual(
      expect.objectContaining({ code: 'INVALID_SWING', path: 'swing' }),
    );
  });

  it('accepts a door that states one', () => {
    expect(
      validateOpening(
        {
          ...door,
          swing: {
            hinge: 'END',
            opensTo: 'LEFT_OF_HOST',
            openingAngleDeg: 45,
          },
        },
        wall,
      ),
    ).toEqual([]);
  });
});
