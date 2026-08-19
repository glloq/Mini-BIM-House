import { describe, expect, it } from 'vitest';
import {
  GENERIC_MATERIAL_REFERENCE,
  genericMaterial,
  genericMaterialCatalog,
  genericMaterialCategories,
} from './generic-catalog.js';
import { validateMaterial } from './materials.js';
import { queryMaterials } from './material-editor.js';

describe('generic material catalogue', () => {
  it('covers the families a first project needs to build a wall', () => {
    const names = genericMaterialCatalog().map(({ id }) => id);
    expect(names).toEqual(
      expect.arrayContaining([
        'generic-concrete',
        'generic-brick',
        'generic-concrete-block',
        'generic-softwood',
        'generic-osb',
        'generic-gypsum-board',
        'generic-glass-wool',
        'generic-rock-wool',
        'generic-wood-fibre',
        'generic-pir',
        'generic-eps',
        'generic-xps',
        'generic-air-cavity',
        'generic-glass',
        'generic-steel',
        'generic-aluminium',
      ]),
    );
  });

  it('validates and declares every entry as generic, never as a product', () => {
    for (const material of genericMaterialCatalog()) {
      expect(validateMaterial(material)).toEqual([]);
      expect(material.kind).toBe('GENERIC');
      expect(material.manufacturer).toBeUndefined();
    }
  });

  it('names the source of every declared property', () => {
    for (const material of genericMaterialCatalog()) {
      const sourced = new Set(
        (material.sources ?? []).map(({ property }) => property),
      );
      for (const property of Object.keys(material.properties))
        expect(sourced.has(property)).toBe(true);
      expect(
        (material.sources ?? []).every(
          ({ sourceType, reference }) =>
            sourceType === 'STANDARD' && (reference ?? '') !== '',
        ),
      ).toBe(true);
    }
    expect(
      genericMaterial('generic-concrete')?.sources?.find(
        ({ property }) => property === 'lambdaWmK',
      )?.reference,
    ).toBe(GENERIC_MATERIAL_REFERENCE);
  });

  it('carries the thermal properties the envelope modules require', () => {
    for (const material of genericMaterialCatalog()) {
      expect(typeof material.properties.lambdaWmK).toBe('number');
      expect(typeof material.properties.densityKgM3).toBe('number');
      expect(typeof material.properties.mu).toBe('number');
    }
  });

  it('is searchable and filterable through the material editor query', () => {
    const catalog = genericMaterialCatalog();
    expect(
      queryMaterials(catalog, { search: 'laine' }).map(
        ({ material }) => material.id,
      ),
    ).toEqual(['generic-rock-wool', 'generic-glass-wool']);
    expect(
      queryMaterials(catalog, { categories: ['INSULATION'] }),
    ).toHaveLength(6);
    // Nothing declares an equivalent air layer thickness, and the query says so
    // rather than treating the absence as a zero.
    expect(
      queryMaterials(catalog, {
        requiredProperties: ['sdM'],
        missingPropertiesOnly: true,
      }),
    ).toHaveLength(catalog.length);
  });

  it('returns fresh entries so a project never shares catalogue references', () => {
    expect(genericMaterialCatalog()[0]).not.toBe(genericMaterialCatalog()[0]);
    expect(genericMaterialCategories()).toContain('INSULATION');
    expect(genericMaterial('nope')).toBeUndefined();
  });
});
