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

/**
 * Every opening file under `data`, found rather than listed.
 *
 * The tree is the list: adding a file is `git add`, and nothing else. Sorted by
 * path so that two machines, and two runs, read the entries in the same order
 * — a fingerprint over an arbitrary order is one that moves when the
 * filesystem does.
 */
const DISCOVERED = import.meta.glob('../data/**/*.json', {
  eager: true,
  import: 'default',
}) as Readonly<Record<string, CatalogFile>>;

const FILES: readonly CatalogFile[] = Object.keys(DISCOVERED)
  .sort()
  .map((path) => DISCOVERED[path]!);

/** The files this catalogue is made of, in a stable order. */
export function openingCatalogSources(): readonly string[] {
  return Object.keys(DISCOVERED)
    .map((path) => path.replace('../', 'packages/opening-catalog/'))
    .sort();
}

/** Every entry as the files state them, unchecked and unrepaired. */
export function rawGenericOpeningEntries(): readonly OpeningDefinition[] {
  return FILES.flatMap(({ openings }) => openings);
}

/** What the catalogue files themselves are: their shape has a version too. */
export const GENERIC_OPENING_FORMAT_VERSION =
  FILES[0]?.formatVersion ?? '1.0.0';

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
