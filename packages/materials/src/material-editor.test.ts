import { describe, expect, it } from 'vitest';
import {
  createCustomMaterialFromDraft,
  materialId,
  parseMaterial,
  queryMaterials,
  type Material,
} from './index.js';

const materials: Material[] = [
  {
    id: materialId('wood-fibre'),
    name: 'Fibre de bois',
    kind: 'GENERIC',
    category: 'INSULATION',
    properties: { lambdaWmK: 0.038 },
    sources: [{ property: 'lambdaWmK', sourceType: 'DATABASE' }],
  },
  {
    id: materialId('brick'),
    name: 'Brick product',
    kind: 'PRODUCT',
    category: 'MASONRY',
    manufacturer: 'Example',
    properties: { densityKgM3: 1800 },
  },
];

describe('material editor model', () => {
  it('searches accent-insensitively and combines filters', () => {
    expect(
      queryMaterials(materials, { search: 'fibre', kinds: ['GENERIC'] }).map(
        ({ material }) => material.id,
      ),
    ).toEqual(['wood-fibre']);
    expect(
      queryMaterials(materials, {
        categories: ['MASONRY'],
        manufacturer: 'example',
      }),
    ).toHaveLength(1);
  });
  it('reports missing and unsourced properties without defaults', () => {
    const rows = queryMaterials(materials, {
      requiredProperties: ['lambdaWmK', 'densityKgM3'],
      missingPropertiesOnly: true,
    });
    expect(rows[0]).toMatchObject({
      missingProperties: ['densityKgM3'],
      sourcedProperties: ['lambdaWmK'],
    });
    expect(rows[1]).toMatchObject({
      missingProperties: ['lambdaWmK'],
      unsourcedProperties: ['densityKgM3'],
    });
  });
  it('creates custom materials with explicit provenance', () => {
    expect(
      createCustomMaterialFromDraft({
        id: materialId('custom'),
        name: 'Custom',
        properties: { lambdaWmK: 0.04 },
        sources: [{ property: 'lambdaWmK', sourceType: 'USER' }],
      }),
    ).toMatchObject({ status: 'OK', material: { kind: 'CUSTOM' } });
  });
  it('safely parses external JSON and preserves extension properties', () => {
    expect(
      parseMaterial({
        id: 'external',
        name: 'External',
        kind: 'GENERIC',
        properties: { customMetric: 42 },
      }),
    ).toMatchObject({
      status: 'OK',
      material: { properties: { customMetric: 42 } },
    });
    expect(
      parseMaterial({
        id: 'bad',
        name: 'Bad',
        kind: 'GENERIC',
        properties: { lambdaWmK: Number.NaN },
      }),
    ).toMatchObject({ status: 'INVALID' });
  });
});
