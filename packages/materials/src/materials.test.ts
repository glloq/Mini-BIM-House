import { describe, expect, it } from 'vitest';

import {
  createCustomMaterial,
  createMaterial,
  duplicateAsCustom,
  materialId,
  validateMaterial,
  type Material,
} from './index.js';

describe('material catalog', () => {
  it('creates a custom material with property-level provenance', () => {
    const material = createCustomMaterial(
      materialId('local-straw'),
      'Local straw',
      { densityKgM3: 95, lambdaWmK: 0.052 },
      [
        {
          property: 'lambdaWmK',
          sourceType: 'USER',
          reference: 'Measured sample',
        },
      ],
    );
    expect(material).toMatchObject({
      kind: 'CUSTOM',
      properties: { lambdaWmK: 0.052 },
    });
    expect(material.sources?.[0]?.sourceType).toBe('USER');
  });

  it.each(['GENERIC', 'PRODUCT', 'CUSTOM'] as const)(
    'supports %s materials',
    (kind) => {
      const material = createMaterial({
        id: materialId(kind.toLowerCase()),
        name: `${kind} material`,
        kind,
        properties: {},
        ...(kind === 'PRODUCT' ? { manufacturer: 'Example manufacturer' } : {}),
      });
      expect(material.kind).toBe(kind);
    },
  );

  it('preserves unknown properties instead of defaulting or discarding them', () => {
    const material = createCustomMaterial(
      materialId('experimental'),
      'Experimental',
      {
        experimentalMetric: { value: 14, unit: 'widgets' },
      },
    );
    expect(material.properties.lambdaWmK).toBeUndefined();
    expect(material.properties.experimentalMetric).toEqual({
      value: 14,
      unit: 'widgets',
    });
    expect(JSON.parse(JSON.stringify(material))).toEqual(material);
  });

  it('keeps unknown values unknown rather than silently using zero', () => {
    const material = createCustomMaterial(
      materialId('unknowns'),
      'Unknown properties',
    );
    expect(material.properties).toEqual({});
    expect(material.properties.densityKgM3).toBeUndefined();
  });

  it('validates schema numeric constraints with exact paths', () => {
    const invalid = {
      id: materialId('invalid'),
      name: 'Invalid',
      kind: 'GENERIC',
      properties: { lambdaWmK: 0, emissivity: 1.2, sdM: -1 },
    } satisfies Material;
    expect(validateMaterial(invalid).map((issue) => issue.path)).toEqual([
      'properties.lambdaWmK',
      'properties.emissivity',
      'properties.sdM',
    ]);
    expect(() => createMaterial(invalid)).toThrow('properties.lambdaWmK');
  });

  it('duplicates a catalog material without mutating it', () => {
    const system = createMaterial({
      id: materialId('system-concrete'),
      name: 'Concrete',
      kind: 'GENERIC',
      properties: { densityKgM3: 2_300 },
    });
    const custom = duplicateAsCustom(
      system,
      materialId('project-concrete'),
      'My concrete',
    );
    expect(custom).toMatchObject({
      id: 'project-concrete',
      name: 'My concrete',
      kind: 'CUSTOM',
    });
    expect(system).toMatchObject({ id: 'system-concrete', kind: 'GENERIC' });
  });

  it('rejects empty IDs, names, source properties, and non-finite values', () => {
    expect(() => materialId(' ')).toThrow(TypeError);
    expect(() => createCustomMaterial(materialId('unnamed'), ' ')).toThrow(
      RangeError,
    );
    expect(() =>
      createCustomMaterial(materialId('nan'), 'NaN', {
        densityKgM3: Number.NaN,
      }),
    ).toThrow(RangeError);
    expect(() =>
      createCustomMaterial(materialId('source'), 'Source', {}, [
        { property: '', sourceType: 'OTHER' },
      ]),
    ).toThrow(RangeError);
  });
});
