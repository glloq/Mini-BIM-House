import { describe, expect, it } from 'vitest';
import {
  buildCatalogIndex,
  familiesExercisedBy,
  family,
  propertyDefinition,
  propertySchema,
  qualificationHouse,
  qualificationHouseFile,
  syntheticEntries,
  syntheticSummaries,
  validateCatalogEntry,
} from './index.js';
import { rawGenericEquipmentEntries } from '@house-technical-designer/equipment-catalog';
import { rawGenericOpeningEntries } from '@house-technical-designer/opening-catalog';
import { NETWORK_PRODUCT_REGISTRY } from '@house-technical-designer/network-products';
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  validateProjectFile,
} from '@house-technical-designer/project-io';

describe('a catalogue the size the real one will be', () => {
  it('gives the same catalogue twice, so a measure compares code and not draws', () => {
    expect(syntheticSummaries(50)).toEqual(syntheticSummaries(50));
    expect(syntheticSummaries(50)[7]).toEqual(syntheticSummaries(100)[7]);
  });

  it('spreads ten thousand entries over the real families', () => {
    const summaries = syntheticSummaries(10_000);
    expect(summaries).toHaveLength(10_000);
    expect(new Set(summaries.map(({ id }) => id)).size).toBe(10_000);
    expect(
      new Set(summaries.map(({ familyId }) => familyId)).size,
    ).toBeGreaterThan(300);
    for (const summary of summaries.slice(0, 200))
      expect(family(summary.familyId!)).toBeDefined();
  });

  it('produces entries the gate accepts, at ten thousand', () => {
    // A generator whose entries the gate ignores would measure the speed of
    // doing nothing.
    const known = {
      family,
      schema: propertySchema,
      symbols: new Set<string>(),
      property: propertyDefinition,
    };
    const issues = syntheticEntries(10_000).flatMap((entry) =>
      validateCatalogEntry(entry, known),
    );
    expect(issues.slice(0, 3)).toEqual([]);
  });

  it('indexes ten thousand summaries and answers from the maps', () => {
    const summaries = syntheticSummaries(10_000);
    const index = buildCatalogIndex(summaries);
    expect(index.all).toHaveLength(10_000);
    // The index and a full scan have to agree, or the maps are a faster way of
    // being wrong.
    const byFamily = index.byFamily.get('RADIATOR') ?? [];
    expect(byFamily).toEqual(
      summaries.filter(({ familyId }) => familyId === 'RADIATOR'),
    );
    expect(index.find({ text: 'fabricant 0' }).length).toBeGreaterThan(0);
    expect(
      index
        .find({ registries: ['MATERIAL'] })
        .every(({ registry }) => registry === 'MATERIAL'),
    ).toBe(true);
  });
});

describe('one of everything, carried by a project', () => {
  it('holds an entry of every catalogue the application ships', () => {
    const house = qualificationHouse();
    expect(house.equipment).toHaveLength(rawGenericEquipmentEntries().length);
    expect(house.openingTypes).toHaveLength(rawGenericOpeningEntries().length);
    expect(house.networkProducts).toHaveLength(NETWORK_PRODUCT_REGISTRY.length);
    expect(house.materialLibrary?.materials.length).toBe(16);
    expect(house.assemblies).toHaveLength(7);
  });

  it('is a project the importer accepts', () => {
    // The property this fixture exists for: every entry the application ships
    // can be carried by a project that reopens. An entry that cannot is one
    // whose only failure mode is discovered by a user, months later.
    expect(
      validateProjectFile(
        qualificationHouseFile(CURRENT_PROJECT_SCHEMA_VERSION),
      ),
    ).toEqual([]);
  });

  it('makes « nobody has ever put one of these in a project » visible', () => {
    // The reference house is a house: it holds four families, because that is
    // what a house holds. Every other entry was carried by nothing.
    const exercised = familiesExercisedBy(qualificationHouse());
    for (const entry of rawGenericEquipmentEntries())
      expect(exercised.has(entry.familyId), entry.id).toBe(true);
    for (const entry of rawGenericOpeningEntries())
      expect(exercised.has(entry.familyId), entry.id).toBe(true);
    for (const product of NETWORK_PRODUCT_REGISTRY)
      expect(exercised.has(product.family), product.id).toBe(true);
  });
});
