import { describe, expect, it } from 'vitest';
import {
  assemblyId,
  assemblyLayerId,
  type Assembly,
} from '@house-technical-designer/assemblies';
import {
  entityId,
  type Opening,
  type Wall,
} from '@house-technical-designer/core-domain';
import { materialId, type Material } from '@house-technical-designer/materials';
import { calculateWallQuantities, quantitiesToCsv } from './index.js';

const material: Material = {
  id: materialId('material'),
  name: 'Material',
  kind: 'GENERIC',
  properties: { densityKgM3: 100 },
};
const assembly: Assembly = {
  id: assemblyId('assembly'),
  name: 'Wall',
  category: 'WALL',
  layers: [
    { id: assemblyLayerId('layer'), materialId: material.id, thicknessM: 0.2 },
  ],
};
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
  assemblyId: assembly.id,
  baseOffsetMm: 0,
  heightMode: 'EXPLICIT',
  heightMm: 2500,
  role: 'EXTERIOR',
};
const opening: Opening = {
  id: entityId<'Opening'>('opening'),
  type: 'OPENING',
  openingType: 'WINDOW',
  host: { kind: 'WALL', id: wall.id },
  offsetAlongHostMm: 1000,
  sillHeightMm: 900,
  widthMm: 1200,
  heightMm: 1000,
};

describe('wall quantities', () => {
  it('calculates analytic length, gross/net areas, volume and mass in SI', () => {
    const result = calculateWallQuantities(
      [wall],
      [opening],
      [assembly],
      [material],
    );
    expect(result.status).toBe('OK');
    const values = Object.fromEntries(
      result.items.map(({ quantityType, value }) => [quantityType, value]),
    );
    expect(values.LENGTH).toBeCloseTo(4);
    expect(values.AREA).toBeCloseTo(8.8);
    expect(values.VOLUME).toBeCloseTo(1.76);
    expect(values.MASS).toBeCloseTo(176);
    expect(
      result.items.find(({ id }) => id.endsWith('gross-area'))?.value,
    ).toBe(10);
  });
  it('keeps unknown density unknown and omits mass', () => {
    const unknown = { ...material, properties: {} };
    const result = calculateWallQuantities([wall], [], [assembly], [unknown]);
    expect(result).toMatchObject({
      status: 'PARTIAL',
      warnings: [expect.objectContaining({ code: 'MISSING_DENSITY' })],
    });
    expect(
      result.items.some(({ quantityType }) => quantityType === 'MASS'),
    ).toBe(false);
  });
  it('keeps unresolved wall height partial rather than zero', () => {
    const toLevel: Wall = {
      ...wall,
      heightMode: 'TO_LEVEL',
      topLevelId: entityId<'Level'>('upper'),
    };
    expect(
      calculateWallQuantities([toLevel], [], [assembly], [material]),
    ).toMatchObject({
      status: 'PARTIAL',
      warnings: [expect.objectContaining({ code: 'UNKNOWN_HEIGHT' })],
    });
  });
  it('exports traceable CSV rows', () => {
    const csv = quantitiesToCsv(
      calculateWallQuantities([wall], [opening], [assembly], [material]),
    );
    expect(csv).toContain('sourceEntityId');
    expect(csv).toContain('wall-quantities-v1');
    expect(csv).toContain('wall:net-area');
  });
});
