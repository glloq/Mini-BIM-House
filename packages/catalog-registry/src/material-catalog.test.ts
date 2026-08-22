import { describe, expect, it } from 'vitest';
import {
  family,
  propertySchema,
  validateAssemblyCatalog,
  validateAssemblyEntry,
  validateMaterialCatalog,
  validateMaterialEntry,
  genericAssemblies,
  type AssemblyEntryCandidate,
  type MaterialEntryCandidate,
} from './index.js';
import { rawGenericMaterialEntries } from '@house-technical-designer/materials';
import { rawGenericAssemblyEntries } from '@house-technical-designer/assemblies';

const known = { family, schema: propertySchema };
const materials = new Set(rawGenericMaterialEntries().map(({ id }) => id));

const material = (
  patch: Partial<MaterialEntryCandidate> = {},
): MaterialEntryCandidate => ({
  id: 'generic-rock-wool',
  familyId: 'ROCK_WOOL',
  category: 'INSULATION',
  name: 'Laine de roche',
  version: '1.0.0',
  provenance: { type: 'STANDARD', reference: 'ISO 10456' },
  properties: { thermalConductivity: 0.038, density: 40 },
  ...patch,
});

const assembly = (
  patch: Partial<AssemblyEntryCandidate> = {},
): AssemblyEntryCandidate => ({
  id: 'generic-partition-stud',
  familyId: 'PARTITION',
  category: 'PARTITION',
  name: 'Cloison',
  version: '1.0.0',
  provenance: { type: 'GENERIC', reference: 'Composition courante' },
  layers: [
    { id: 'board', materialId: 'generic-gypsum-board', thicknessM: 0.013 },
  ],
  ...patch,
});

describe('the material catalogue goes through a gate like everything else', () => {
  it('passes on everything the application ships', () => {
    expect(validateMaterialCatalog()).toEqual([]);
    expect(rawGenericMaterialEntries()).toHaveLength(16);
  });

  it('refuses a family that is not a material family', () => {
    expect(
      validateMaterialEntry(
        material({ familyId: 'RADIATOR', category: 'RADIATOR' }),
        known,
      ).map(({ message }) => message),
    ).toContain('RADIATOR is not a material family');
  });

  it('refuses a property the family does not declare', () => {
    // Two vocabularies for one quantity is how they drift: the data file
    // speaks the property registry's language, and `lambdaWmK` is the model's.
    expect(
      validateMaterialEntry(
        material({ properties: { lambdaWmK: 0.038 } }),
        known,
      ).map(({ path }) => path),
    ).toContain('properties/lambdaWmK');
  });

  it('refuses an absorption coefficient outside nought and one', () => {
    const issues = validateMaterialEntry(
      material({
        properties: {
          thermalConductivity: 0.038,
          acousticAbsorption: { '500': 1.4 },
        },
      }),
      known,
    );
    expect(issues.map(({ path }) => path)).toContain(
      'properties/acousticAbsorption/500',
    );
  });

  it('refuses a band no standard files anything at', () => {
    expect(
      validateMaterialEntry(
        material({
          properties: {
            thermalConductivity: 0.038,
            acousticAbsorption: { '300': 0.4 },
          },
        }),
        known,
      ).map(({ message }) => message),
    ).toContain(
      '300 Hz is not one of the octave bands 63, 125, 250, 500, 1000, 2000, 4000, 8000',
    );
  });

  it('refuses a category that disagrees with the family', () => {
    expect(
      validateMaterialEntry(material({ category: 'METAL' }), known).map(
        ({ message }) => message,
      ),
    ).toContain('says METAL where ROCK_WOOL says INSULATION');
  });

  it('asks every entry for a version and a provenance', () => {
    const { version: _v, provenance: _p, ...bare } = material();
    expect(
      validateMaterialEntry(bare as MaterialEntryCandidate, known).map(
        ({ path }) => path,
      ),
    ).toEqual(['version', 'provenance']);
  });
});

describe('the build-ups, and what they are made of', () => {
  it('passes on everything the application ships', () => {
    expect(validateAssemblyCatalog()).toEqual([]);
    expect(rawGenericAssemblyEntries()).toHaveLength(7);
  });

  it('refuses a layer of a material nothing ships', () => {
    // It draws a wall, it costs nothing, it insulates nothing, and every
    // calculation reading it quietly skips a layer.
    expect(
      validateAssemblyEntry(
        assembly({
          layers: [
            { id: 'board', materialId: 'generic-unobtanium', thicknessM: 0.1 },
          ],
        }),
        { ...known, materials },
      ).map(({ message }) => message),
    ).toEqual(['unknown material generic-unobtanium']);
  });

  it('refuses a thickness written in millimetres', () => {
    // A layer of 140 would be a hundred and forty metres of polystyrene, and
    // would read as perfectly valid.
    expect(
      validateAssemblyEntry(
        assembly({
          layers: [{ id: 'insul', materialId: 'generic-eps', thicknessM: 140 }],
        }),
        { ...known, materials },
      ).map(({ message }) => message),
    ).toEqual([
      '140 m is thicker than any layer of a building; thicknesses are in metres',
    ]);
  });

  it('refuses a build-up with no layers, and one layer named twice', () => {
    expect(
      validateAssemblyEntry(assembly({ layers: [] }), {
        ...known,
        materials,
      }).map(({ message }) => message),
    ).toEqual(['a build-up has layers']);
    const twice = assembly().layers[0]!;
    expect(
      validateAssemblyEntry(assembly({ layers: [twice, twice] }), {
        ...known,
        materials,
      }).map(({ message }) => message),
    ).toEqual(['board is declared more than once']);
  });

  it('gives the application its starting build-ups, from data', () => {
    const built = genericAssemblies();
    expect(built).toHaveLength(7);
    for (const entry of built) {
      expect(entry.layers.length).toBeGreaterThan(0);
      for (const layer of entry.layers)
        expect(materials.has(layer.materialId)).toBe(true);
    }
    expect(new Set(built.map(({ category }) => category))).toEqual(
      new Set(['WALL', 'ROOF', 'FLOOR', 'PARTITION']),
    );
  });
});
