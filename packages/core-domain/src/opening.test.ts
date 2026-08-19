import { describe, expect, it } from 'vitest';
import { assemblyId } from '@house-technical-designer/assemblies';
import { entityId } from './ids.js';
import {
  calculateWallNetArea,
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
