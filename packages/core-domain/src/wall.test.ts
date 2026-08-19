import { describe, expect, it } from 'vitest';
import {
  assemblyId,
  assemblyLayerId,
  type Assembly,
} from '@house-technical-designer/assemblies';
import { materialId } from '@house-technical-designer/materials';
import { entityId } from './ids.js';
import { deriveWallFaces, validateWall, type Wall } from './wall.js';

const assembly: Assembly = {
  id: assemblyId('wall-assembly'),
  name: 'Wall',
  category: 'WALL',
  layers: [
    {
      id: assemblyLayerId('layer'),
      materialId: materialId('material'),
      thicknessM: 0.2,
    },
  ],
};
const wall: Wall = {
  id: entityId<'Wall'>('wall-1'),
  type: 'WALL',
  levelId: entityId<'Level'>('ground'),
  path: {
    points: [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
    ],
  },
  referenceSide: 'CENTER',
  assemblyId: assembly.id,
  baseOffsetMm: 0,
  heightMode: 'EXPLICIT',
  heightMm: 2500,
  role: 'EXTERIOR',
};

describe('wall domain', () => {
  it('derives centered faces from assembly thickness', () => {
    const faces = deriveWallFaces(wall, assembly);
    expect(faces.thicknessMm).toBeCloseTo(200);
    expect(faces.left.points).toEqual([
      { x: 0, y: 100 },
      { x: 4000, y: 100 },
    ]);
    expect(faces.right.points).toEqual([
      { x: 0, y: -100 },
      { x: 4000, y: -100 },
    ]);
  });
  it.each([
    ['LEFT', 0, -200],
    ['RIGHT', 200, 0],
  ] as const)(
    'honours the %s reference face',
    (referenceSide, leftY, rightY) => {
      const faces = deriveWallFaces({ ...wall, referenceSide }, assembly);
      expect(faces.left.points[0]?.y).toBeCloseTo(leftY);
      expect(faces.right.points[0]?.y).toBeCloseTo(rightY);
    },
  );
  it('keeps missing assembly and invalid height explicit', () => {
    expect(validateWall({ ...wall, heightMm: 0 })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_HEIGHT' }),
        expect.objectContaining({ code: 'MISSING_ASSEMBLY' }),
      ]),
    );
  });
  it('rejects a degenerate reference-path segment', () => {
    expect(
      validateWall(
        {
          ...wall,
          path: {
            points: [
              { x: 0, y: 0 },
              { x: 0, y: 0 },
            ],
          },
        },
        assembly,
      ),
    ).toContainEqual(expect.objectContaining({ code: 'INVALID_PATH' }));
  });
  it('does not mutate persisted wall geometry while deriving faces', () => {
    const before = JSON.stringify(wall);
    deriveWallFaces(wall, assembly);
    expect(JSON.stringify(wall)).toBe(before);
  });
});
