import { describe, expect, it } from 'vitest';
import { materialId } from '@house-technical-designer/materials';
import { numericValue } from '@house-technical-designer/units';
import {
  assemblyId,
  assemblyLayerId,
  createAssembly,
  reverseAssembly,
  totalThicknessMillimetres,
  validateAssembly,
} from './index.js';
import type { Assembly } from './index.js';

const materialA = materialId('material-a');
const materialB = materialId('material-b');
const fixture: Assembly = {
  id: assemblyId('wall-a'),
  name: 'Wall A',
  category: 'WALL',
  layers: [
    {
      id: assemblyLayerId('outside'),
      materialId: materialA,
      thicknessM: 0.02,
      role: 'FINISH',
    },
    {
      id: assemblyLayerId('inside'),
      materialId: materialB,
      thicknessM: 0.18,
      role: 'STRUCTURAL',
    },
  ],
};

describe('assemblies', () => {
  it('preserves explicit layer order and can reverse it', () => {
    expect(createAssembly(fixture).layers.map(({ id }) => id)).toEqual([
      'outside',
      'inside',
    ]);
    expect(reverseAssembly(fixture).layers.map(({ id }) => id)).toEqual([
      'inside',
      'outside',
    ]);
  });
  it('calculates total thickness through the units boundary', () => {
    expect(numericValue(totalThicknessMillimetres(fixture))).toBeCloseTo(200);
  });
  it('reports missing materials without inventing one', () => {
    expect(validateAssembly(fixture, new Set([materialA]))).toContainEqual(
      expect.objectContaining({ code: 'MISSING_MATERIAL' }),
    );
  });
  it.each([0, -0.1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid thickness %s',
    (thicknessM) => {
      const invalid = {
        ...fixture,
        layers: [{ ...fixture.layers[0]!, thicknessM }],
      };
      expect(validateAssembly(invalid)).toContainEqual(
        expect.objectContaining({ code: 'INVALID_THICKNESS' }),
      );
    },
  );
});
