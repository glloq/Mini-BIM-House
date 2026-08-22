import generic from '../data/generic.json' with { type: 'json' };
import type { OpeningCategory, OpeningDefinition } from './types.js';
import type { OpeningDefinition as ProjectOpeningDefinition } from '@house-technical-designer/core-domain';

interface CatalogFile {
  readonly formatVersion: string;
  readonly openings: readonly OpeningDefinition[];
}

/**
 * The openings a project can start from.
 *
 * Twelve to begin with: the windows, doors and shading devices a French house
 * is actually made of. Generic values, and they say so — a real project
 * replaces them with a manufacturer's fiche, which is the same shape.
 */
export const GENERIC_OPENING_REFERENCE =
  'Valeurs de dimensionnement génériques — ne provient d’aucun fabricant';

/** Every entry as the file states it, unchecked and unrepaired. */
export function rawGenericOpeningEntries(): readonly OpeningDefinition[] {
  return (generic as CatalogFile).openings;
}

/** What the catalogue file itself is: its own shape has a version too. */
export const GENERIC_OPENING_FORMAT_VERSION = (generic as CatalogFile)
  .formatVersion;

/** Looks a generic opening up by identifier. */
export function genericOpening(id: string): OpeningDefinition | undefined {
  return rawGenericOpeningEntries().find((entry) => entry.id === id);
}

/** Every entry of one kind: the windows, or the doors, or the shading. */
export function genericOpeningsOfCategory(
  category: OpeningCategory,
): readonly OpeningDefinition[] {
  return rawGenericOpeningEntries().filter(
    (entry) => entry.category === category,
  );
}

/**
 * The transmittance an entry declares, out of the entry it is.
 *
 * The one figure the envelope calculation needs and the one no stack of layers
 * gives: a window's Uw covers the glass, the frame and the spacer together.
 */
export function declaredTransmittance(
  entry: OpeningDefinition,
): number | undefined {
  const value = entry.properties.uw;
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

/**
 * Copies a catalogue opening into the project.
 *
 * A copy, and not a pointer: the same argument as an equipment definition's. A
 * file has to open the same way in two years, and the catalogue it was chosen
 * from will have moved — or will not be installed at all.
 */
export function projectOpeningFromCatalog(
  entry: OpeningDefinition,
): ProjectOpeningDefinition {
  return {
    id: entry.id,
    familyId: entry.familyId,
    category: entry.category,
    name: entry.name,
    version: entry.version,
    ...(entry.manufacturer === undefined
      ? {}
      : { manufacturer: entry.manufacturer }),
    ...(entry.model === undefined ? {} : { model: entry.model }),
    provenance: entry.provenance,
    // Where each figure comes from, one by one: a manufacturer sheet declares
    // half its numbers and computes the other half.
    ...(entry.sources === undefined || entry.sources.length === 0
      ? {}
      : { sources: entry.sources }),
    properties: { ...entry.properties },
  };
}

/** The whole generic catalogue, as a project holds it. */
export function genericOpeningTypes(): readonly ProjectOpeningDefinition[] {
  return rawGenericOpeningEntries().map(projectOpeningFromCatalog);
}
