import { describe, expect, it } from 'vitest';
import { materialId, type Material } from '@house-technical-designer/materials';
import {
  assemblyId,
  assemblyLayerId,
  buildAssemblyEditorModel,
  moveAssemblyLayer,
  setAssemblyLayerMaterial,
  setAssemblyLayerThicknessMm,
  type Assembly,
} from './index.js';

const insulationId = materialId('insulation');
const finishId = materialId('finish');
const materials: Material[] = [
  {
    id: insulationId,
    name: 'Insulation',
    kind: 'GENERIC',
    properties: {},
    appearance: { hatchId: 'insulation' },
  },
  {
    id: finishId,
    name: 'Finish',
    kind: 'GENERIC',
    properties: {},
    appearance: { hatchId: 'finish' },
  },
];
const assembly: Assembly = {
  id: assemblyId('wall'),
  name: 'Wall',
  category: 'WALL',
  layers: [
    { id: assemblyLayerId('outside'), materialId: finishId, thicknessM: 0.02 },
    {
      id: assemblyLayerId('inside'),
      materialId: insulationId,
      thicknessM: 0.18,
    },
  ],
};

describe('assembly editor model', () => {
  it('builds an ordered cross-section in millimetres with material hatches', () => {
    expect(buildAssemblyEditorModel(assembly, materials)).toMatchObject({
      totalThicknessMm: 200,
      layers: [
        { startMm: 0, endMm: 20, hatchId: 'finish', missingMaterial: false },
        {
          startMm: 20,
          endMm: 200,
          hatchId: 'insulation',
          missingMaterial: false,
        },
      ],
    });
  });
  it('reorders layers immutably', () => {
    const reordered = moveAssemblyLayer(assembly, 1, 0);
    expect(reordered.layers.map(({ id }) => id)).toEqual(['inside', 'outside']);
    expect(assembly.layers.map(({ id }) => id)).toEqual(['outside', 'inside']);
  });
  it('updates thickness through the units package', () => {
    expect(
      setAssemblyLayerThicknessMm(assembly, 0, 35).layers[0]?.thicknessM,
    ).toBeCloseTo(0.035);
    expect(() => setAssemblyLayerThicknessMm(assembly, 0, 0)).toThrow(
      RangeError,
    );
  });
  it('rejects a missing replacement material', () => {
    expect(() =>
      setAssemblyLayerMaterial(
        assembly,
        0,
        materialId('missing'),
        new Set([finishId, insulationId]),
      ),
    ).toThrow('unknown material');
  });
  it('keeps a pre-existing missing material explicit in the editor', () => {
    const missing = {
      ...assembly,
      layers: [{ ...assembly.layers[0]!, materialId: materialId('missing') }],
    };
    expect(buildAssemblyEditorModel(missing, materials)).toMatchObject({
      issues: [expect.stringContaining('unknown material')],
      layers: [{ missingMaterial: true }],
    });
  });
});
