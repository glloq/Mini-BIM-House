import { describe, expect, it } from 'vitest';
import {
  family,
  familyCapabilities,
  propertySchema,
  validateOpeningCatalog,
  validateOpeningEntry,
  type OpeningEntryCandidate,
} from './index.js';
import {
  GENERIC_OPENING_FORMAT_VERSION,
  declaredTransmittance,
  genericOpening,
  genericOpeningsOfCategory,
  openingCatalogSources,
  projectOpeningFromCatalog,
  rawGenericOpeningEntries,
} from '@house-technical-designer/opening-catalog';

const known = { family, schema: propertySchema };

const opening = (
  patch: Partial<OpeningEntryCandidate> = {},
): OpeningEntryCandidate => ({
  id: 'generic-window-casement-double',
  familyId: 'WINDOW_CASEMENT',
  category: 'WINDOW',
  name: 'Fenêtre à la française',
  version: '1.0.0',
  provenance: { type: 'GENERIC', reference: 'Valeurs génériques' },
  properties: { width: 1200, height: 1200, uw: 1.4 },
  ...patch,
});

describe('the openings a project can be given', () => {
  it('ships a catalogue where there was a pointer and nothing to point at', () => {
    expect(GENERIC_OPENING_FORMAT_VERSION).toBe('1.0.0');
    expect(openingCatalogSources().length).toBeGreaterThan(1);
    expect(rawGenericOpeningEntries().length).toBeGreaterThanOrEqual(
      openingCatalogSources().length,
    );
    expect(validateOpeningCatalog()).toEqual([]);
  });

  it('covers the three kinds a house is made of', () => {
    expect(genericOpeningsOfCategory('WINDOW').length).toBeGreaterThan(3);
    expect(genericOpeningsOfCategory('DOOR').length).toBeGreaterThan(2);
    expect(
      genericOpeningsOfCategory('SOLAR_PROTECTION').length,
    ).toBeGreaterThan(2);
  });

  it('states the one figure no stack of layers reproduces', () => {
    // A window's Uw covers the glass, the frame and the spacer together.
    for (const entry of rawGenericOpeningEntries())
      if (entry.category !== 'SOLAR_PROTECTION')
        expect(declaredTransmittance(entry)).toBeGreaterThan(0);
    expect(
      declaredTransmittance(genericOpening('generic-roller-shutter')!),
    ).toBeUndefined();
  });

  it('asks an opening in the envelope for its transmittance', () => {
    const { uw: _dropped, ...bare } = opening().properties;
    expect(
      validateOpeningEntry(opening({ properties: bare }), known).map(
        ({ path }) => path,
      ),
    ).toEqual(['properties/uw']);
  });

  it('does not ask a shutter for one, because a shutter is not a hole', () => {
    // It is fitted over an opening rather than being one, and deriving the
    // question from the registry alone would ask it of every blind.
    expect(familyCapabilities('ROLLER_SHUTTER')).not.toContain('PIERCING');
    expect(familyCapabilities('WINDOW_CASEMENT')).toContain('PIERCING');
    expect(
      validateOpeningEntry(
        opening({
          id: 'generic-roller-shutter',
          familyId: 'ROLLER_SHUTTER',
          category: 'SOLAR_PROTECTION',
          properties: { position: 'EXTERNAL', solarReductionFactor: 0.1 },
        }),
        known,
      ),
    ).toEqual([]);
  });

  it('refuses an equipment family, and a category that contradicts the family', () => {
    expect(
      validateOpeningEntry(
        opening({ familyId: 'RADIATOR', category: 'RADIATOR' }),
        known,
      ).map(({ message }) => message),
    ).toContain('RADIATOR is not an opening family');
    expect(
      validateOpeningEntry(opening({ category: 'DOOR' }), known).map(
        ({ message }) => message,
      ),
    ).toContain('says DOOR where WINDOW_CASEMENT says WINDOW');
  });

  it('refuses a property the window schema does not declare', () => {
    expect(
      validateOpeningEntry(
        opening({ properties: { width: 1200, height: 1200, uw: 1.4, uz: 3 } }),
        known,
      ).map(({ path }) => path),
    ).toEqual(['properties/uz']);
  });

  it('copies the whole entry into the project rather than pointing at it', () => {
    const entry = genericOpening('generic-window-tilt-turn-triple')!;
    const copy = projectOpeningFromCatalog(entry);
    expect(copy.id).toBe(entry.id);
    expect(copy.familyId).toBe('WINDOW_TILT_TURN');
    expect(copy.category).toBe('WINDOW');
    expect(copy.version).toBe(entry.version);
    expect(copy.provenance?.type).toBe('GENERIC');
    expect(copy.properties.uw).toBe(0.9);
    expect(copy.properties.gValue).toBe(0.5);
    // The copy is a copy: editing it must not reach back into the catalogue.
    expect(copy.properties).not.toBe(entry.properties);
  });
});
