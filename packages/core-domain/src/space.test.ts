import { describe, expect, it } from 'vitest';
import { assemblyId } from '@house-technical-designer/assemblies';
import { polygonArea } from '@house-technical-designer/geometry';
import { entityId } from './ids.js';
import { detectSpaceBoundaries, validateSpace, type Space } from './space.js';
import type { Wall } from './wall.js';

function wall(
  id: string,
  start: readonly [number, number],
  end: readonly [number, number],
): Wall {
  return {
    id: entityId<'Wall'>(id),
    type: 'WALL',
    levelId: entityId<'Level'>('level'),
    path: {
      points: [
        { x: start[0], y: start[1] },
        { x: end[0], y: end[1] },
      ],
    },
    referenceSide: 'CENTER',
    assemblyId: assemblyId('assembly'),
    baseOffsetMm: 0,
    heightMode: 'EXPLICIT',
    heightMm: 2500,
    role: 'INTERIOR',
  };
}

describe('space boundaries', () => {
  it('detects four rooms even when divider walls meet exterior-wall interiors', () => {
    const walls = [
      wall('bottom', [0, 0], [8000, 0]),
      wall('right', [8000, 0], [8000, 6000]),
      wall('top', [8000, 6000], [0, 6000]),
      wall('left', [0, 6000], [0, 0]),
      wall('vertical', [4000, 0], [4000, 6000]),
      wall('horizontal', [0, 3000], [8000, 3000]),
    ];
    const result = detectSpaceBoundaries(walls);
    expect(result.status).toBe('OK');
    if (result.status === 'OK') {
      expect(result.boundaries).toHaveLength(4);
      expect(
        result.boundaries.map(({ polygon }) => polygonArea(polygon)),
      ).toEqual([12_000_000, 12_000_000, 12_000_000, 12_000_000]);
    }
  });
  it('does not report the exterior face as a room', () => {
    const result = detectSpaceBoundaries([
      wall('a', [0, 0], [10, 0]),
      wall('b', [10, 0], [10, 10]),
      wall('c', [10, 10], [0, 10]),
      wall('d', [0, 10], [0, 0]),
    ]);
    expect(result).toMatchObject({
      status: 'OK',
      boundaries: expect.any(Array),
    });
    if (result.status === 'OK') expect(result.boundaries).toHaveLength(1);
  });
  it('validates a manual boundary but keeps AUTO boundaries derived', () => {
    const automatic: Space = {
      id: entityId<'Space'>('auto'),
      type: 'SPACE',
      levelId: entityId<'Level'>('level'),
      name: 'Room',
      category: 'LIVING',
      boundaryMode: 'AUTO',
    };
    const manual: Space = {
      ...automatic,
      id: entityId<'Space'>('manual'),
      boundaryMode: 'MANUAL',
      manualPolygon: {
        outer: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
      },
    };
    expect(validateSpace(automatic)).toEqual([]);
    expect(validateSpace(manual)).not.toEqual([]);
  });
  it('returns an explicit diagnostic when no cycle exists', () => {
    expect(detectSpaceBoundaries([wall('a', [0, 0], [10, 0])])).toEqual({
      status: 'INVALID',
      reason: 'NO_CLOSED_FACES',
    });
  });
});
