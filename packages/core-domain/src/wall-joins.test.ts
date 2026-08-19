import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assemblyId } from '@house-technical-designer/assemblies';
import { entityId } from './ids.js';
import { resolveStraightWallJoin } from './wall-joins.js';
import type { Wall, WallReferenceSide } from './wall.js';

interface GoldenCase {
  readonly name: string;
  readonly first: readonly [
    readonly [number, number],
    readonly [number, number],
  ];
  readonly second: readonly [
    readonly [number, number],
    readonly [number, number],
  ];
  readonly expectedKind: 'L' | 'T' | 'X' | 'COLLINEAR';
  readonly expectedPoint: readonly [number, number];
}

const goldenCases = JSON.parse(
  readFileSync(
    new URL('../test/fixtures/wall-joins.golden.json', import.meta.url),
    'utf8',
  ),
) as GoldenCase[];

function wall(
  id: string,
  points: GoldenCase['first'],
  referenceSide: WallReferenceSide = 'CENTER',
): Wall {
  return {
    id: entityId<'Wall'>(id),
    type: 'WALL',
    levelId: entityId<'Level'>('ground'),
    path: { points: points.map(([x, y]) => ({ x, y })) },
    referenceSide,
    assemblyId: assemblyId('assembly'),
    baseOffsetMm: 0,
    heightMode: 'EXPLICIT',
    heightMm: 2500,
    role: 'EXTERIOR',
  };
}

describe('straight wall joins', () => {
  it.each(goldenCases)(
    '$name',
    ({ first, second, expectedKind, expectedPoint }) => {
      const result = resolveStraightWallJoin(
        wall('first', first),
        wall('second', second),
      );
      expect(result).toMatchObject({
        status: 'JOINED',
        kind: expectedKind,
        point: { x: expectedPoint[0], y: expectedPoint[1] },
      });
    },
  );
  it('honours explicit disallow policy', () => {
    const result = resolveStraightWallJoin(
      wall('a', [
        [0, 0],
        [1, 0],
      ]),
      wall('b', [
        [1, 0],
        [1, 1],
      ]),
      'DISALLOW',
    );
    expect(result).toEqual({
      status: 'NO_JOIN',
      kind: 'NONE',
      reason: 'POLICY_DISALLOWS',
    });
  });
  it('rejects polylines until multi-segment joins are implemented', () => {
    const bent = {
      ...wall('a', [
        [0, 0],
        [1, 0],
      ]),
      path: {
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
      },
    };
    expect(
      resolveStraightWallJoin(
        bent,
        wall('b', [
          [1, 0],
          [1, 1],
        ]),
      ),
    ).toEqual({ status: 'INVALID', reason: 'NON_STRAIGHT_WALL' });
  });
});
