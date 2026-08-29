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
  it("accepte une pièce sans écart d'étiquette et refuse un écart non fini", () => {
    /*
     * Le champ est facultatif, et c'est ce qui fait qu'un fichier écrit avant
     * lui s'ouvre : une pièce qui ne le porte pas est valide, sans valeur par
     * défaut à inventer. Ce qui n'est pas valide, c'est un écart qui ne
     * désigne aucun point — l'étiquette n'aurait alors nulle part où aller.
     */
    const room: Space = {
      id: entityId<'Space'>('auto'),
      type: 'SPACE',
      levelId: entityId<'Level'>('level'),
      name: 'Room',
      category: 'LIVING',
      boundaryMode: 'AUTO',
    };
    expect(validateSpace(room)).toEqual([]);
    expect(
      validateSpace({ ...room, labelOffsetMm: { x: -420, y: 900 } }),
    ).toEqual([]);
    expect(
      validateSpace({ ...room, labelOffsetMm: { x: Number.NaN, y: 0 } }),
    ).toEqual(['labelOffsetMm must be a finite point']);
    // Une pièce tracée à la main porte l'écart de la même façon : il est sur
    // `SpaceBase`, pas sur l'une des deux branches de contour.
    expect(
      validateSpace({
        ...room,
        boundaryMode: 'MANUAL',
        manualPolygon: {
          outer: [
            { x: 0, y: 0 },
            { x: 1_000, y: 0 },
            { x: 1_000, y: 1_000 },
          ],
        },
        labelOffsetMm: { x: 0, y: Number.POSITIVE_INFINITY },
      }),
    ).toEqual(['labelOffsetMm must be a finite point']);
  });
  it('returns an explicit diagnostic when no cycle exists', () => {
    expect(detectSpaceBoundaries([wall('a', [0, 0], [10, 0])])).toEqual({
      status: 'INVALID',
      reason: 'NO_CLOSED_FACES',
    });
  });
});
