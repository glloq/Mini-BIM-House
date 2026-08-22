import { describe, expect, it } from 'vitest';
import {
  GENERIC_MATERIAL_FORMAT_VERSION,
  GENERIC_MATERIAL_REFERENCE,
  genericMaterial,
  genericMaterialCatalog,
  genericMaterialCategories,
  genericMaterialFamily,
  materialCatalogSources,
  rawGenericMaterialEntries,
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
      // The acoustic coefficients do not come from the same page as the
      // thermal ones, and the catalogue no longer says they do: `GENERIC` was
      // missing from the list, so a design figure had to wear a standard's
      // authority to be stated at all.
      expect(
        (material.sources ?? []).every(
          ({ sourceType, reference }) =>
            (sourceType === 'STANDARD' || sourceType === 'GENERIC') &&
            (reference ?? '') !== '',
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
    // What the query has to find is read from the catalogue rather than
    // written down here: a filling wave adds wools, and a literal list would
    // make « the search still works » a TypeScript change every time data
    // arrives — which is the thing the format freeze exists to refuse.
    const wools = new Set(
      catalog
        .filter(({ name }) => name.toLowerCase().includes('laine'))
        .map(({ id }) => id),
    );
    expect(wools.size).toBeGreaterThan(1);
    expect(
      new Set(
        queryMaterials(catalog, { search: 'laine' }).map(
          ({ material }) => material.id,
        ),
      ),
    ).toEqual(wools);
    const insulation = rawGenericMaterialEntries().filter(
      ({ category }) => category === 'INSULATION',
    );
    expect(insulation.length).toBeGreaterThan(5);
    expect(
      queryMaterials(catalog, { categories: ['INSULATION'] }),
    ).toHaveLength(insulation.length);
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

  it('lives in data, and says which family each entry belongs to', () => {
    // It was the last of the seven registries still written in TypeScript: a
    // file nobody reads, that two people cannot edit at once, and that no gate
    // could check.
    expect(GENERIC_MATERIAL_FORMAT_VERSION).toBe('1.0.0');
    // Several files, every one of them carrying entries: the shape of « the
    // tree is the list », stated without a total that a filling wave moves.
    expect(materialCatalogSources().length).toBeGreaterThan(1);
    expect(rawGenericMaterialEntries().length).toBeGreaterThanOrEqual(
      materialCatalogSources().length,
    );
    for (const entry of rawGenericMaterialEntries()) {
      expect(entry.familyId).toMatch(/^[A-Z][A-Z0-9_]*$/u);
      expect(entry.version).toMatch(/^\d+\.\d+\.\d+$/u);
      expect(entry.provenance.reference).not.toBe('');
      // The data file speaks the property registry's language, not the
      // model's: two vocabularies for one quantity is what this closes.
      expect(entry.properties).not.toHaveProperty('lambdaWmK');
    }
    expect(genericMaterialFamily('generic-glass-wool')).toBe('GLASS_WOOL');
    expect(genericMaterialFamily('nope')).toBeUndefined();
  });
});
