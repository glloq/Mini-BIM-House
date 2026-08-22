import type { DataRegistry } from '@house-technical-designer/technical-types';
import {
  equipmentCatalogSources,
  rawGenericEquipmentEntries,
} from '@house-technical-designer/equipment-catalog';
import {
  GENERIC_MATERIAL_FORMAT_VERSION,
  materialCatalogSources,
  rawGenericMaterialEntries,
} from '@house-technical-designer/materials';
import {
  GENERIC_ASSEMBLY_FORMAT_VERSION,
  assemblyCatalogSources,
  rawGenericAssemblyEntries,
} from '@house-technical-designer/assemblies';
import {
  GENERIC_OPENING_FORMAT_VERSION,
  openingCatalogSources,
  rawGenericOpeningEntries,
} from '@house-technical-designer/opening-catalog';
import {
  GENERIC_SYMBOL_FORMAT_VERSION,
  rawGenericSymbolEntries,
  symbolCatalogSources,
} from '@house-technical-designer/drawing-engine';
import {
  NETWORK_PRODUCT_REGISTRY,
  networkProductCatalogSources,
} from '@house-technical-designer/network-products';
import { contentFingerprint } from './catalog-validation.js';
import {
  DEFAULT_LIFECYCLE,
  isCatalogLifecycle,
  type CatalogLifecycle,
} from './catalog-identity.js';
import type { CatalogSummary } from './catalog-index.js';
import type {
  CatalogManifest,
  CatalogManifestEntry,
  CatalogRepository,
} from './catalog-repository.js';
import { bundledCatalogRepository } from './catalog-repository.js';
import { capabilitiesOf } from './capabilities.js';
import {
  family,
  genericCatalog,
  propertyDefinition,
  propertySchema,
  type FamilyEvidence,
} from './registry.js';
import { validateCatalogEntry } from './catalog-validation.js';

/** The glyphs the library holds, as a set the gate can be given. */
function shippedSymbols(): ReadonlySet<string> {
  return new Set(rawGenericSymbolEntries().map(({ id }) => id));
}

/**
 * The shape every catalogue file is written in.
 *
 * Not the data's version: this changes when the *shape* changes, which is rare
 * and breaking, and it is what tells an application whether it can read a
 * folder of catalogues at all.
 */
export const CATALOG_FORMAT_VERSION = '1.0.0';

function lifecycleOf(familyId: string | undefined): CatalogLifecycle {
  const declared =
    familyId === undefined ? undefined : family(familyId)?.lifecycle;
  return declared !== undefined && isCatalogLifecycle(declared)
    ? declared
    : DEFAULT_LIFECYCLE;
}

function summary(
  registry: DataRegistry,
  entry: {
    readonly id: string;
    readonly version?: string;
    readonly label: string;
    readonly familyId?: string;
    readonly category?: string;
    readonly manufacturer?: string;
    readonly valid?: boolean;
  },
): CatalogSummary {
  const owner =
    entry.familyId === undefined ? undefined : family(entry.familyId);
  return {
    ref: { registry, id: entry.id, version: entry.version ?? '' },
    registry,
    id: entry.id,
    version: entry.version ?? '',
    label: entry.label,
    ...(entry.familyId === undefined ? {} : { familyId: entry.familyId }),
    ...(entry.category === undefined ? {} : { category: entry.category }),
    ...(owner === undefined ? {} : { domain: owner.domain }),
    lifecycle: lifecycleOf(entry.familyId),
    capabilities: owner === undefined ? [] : capabilitiesOf(owner),
    // Answered once, here, by whoever ran the gate. Recomputing it per render
    // is invisible at nineteen entries and four seconds at ten thousand.
    valid: entry.valid ?? true,
    ...(entry.manufacturer === undefined
      ? {}
      : { manufacturer: entry.manufacturer }),
  };
}

/**
 * Every entry the application ships, reduced to a row.
 *
 * Six registries in one list, which is the whole point: a browser that has to
 * ask six packages six different questions is a browser that will answer a
 * seventh registry by ignoring it.
 */
export function catalogSummaries(): readonly CatalogSummary[] {
  // The gate reads a fiche as its file states it, and one of the things it
  // refuses is a fiche restating its family's category. A resolved entry
  // carries that category — the resolver stamps it — so asking the gate about
  // the resolved form made every equipment fiche in the application report
  // itself invalid, and every equipment family read « PARTIAL » in the
  // browser. It is the raw entry that has to be asked.
  const clean = new Set(
    rawGenericEquipmentEntries()
      .filter(
        (entry) =>
          validateCatalogEntry(entry, {
            family,
            schema: propertySchema,
            symbols: shippedSymbols(),
            property: propertyDefinition,
          }).length === 0,
      )
      .map(({ id }) => id),
  );
  return [
    ...genericCatalog().map((entry) =>
      summary('EQUIPMENT', {
        id: entry.id,
        version: entry.version,
        label: entry.name,
        familyId: entry.familyId,
        valid: clean.has(entry.id),
        ...(entry.category === undefined ? {} : { category: entry.category }),
        ...(entry.manufacturer === undefined
          ? {}
          : { manufacturer: entry.manufacturer }),
      }),
    ),
    ...rawGenericMaterialEntries().map((entry) =>
      summary('MATERIAL', {
        id: entry.id,
        version: entry.version,
        label: entry.name,
        familyId: entry.familyId,
        category: entry.category,
      }),
    ),
    ...rawGenericOpeningEntries().map((entry) =>
      summary('OPENING', {
        id: entry.id,
        version: entry.version,
        label: entry.name,
        familyId: entry.familyId,
        category: entry.category,
      }),
    ),
    ...rawGenericAssemblyEntries().map((entry) =>
      summary('ASSEMBLY', {
        id: entry.id,
        version: entry.version,
        label: entry.name,
        familyId: entry.familyId,
        category: entry.category,
      }),
    ),
    ...NETWORK_PRODUCT_REGISTRY.map((product) =>
      summary('NETWORK_PRODUCT', {
        id: product.id,
        ...(product.version === undefined ? {} : { version: product.version }),
        label: product.label,
        familyId: product.family,
      }),
    ),
    ...rawGenericSymbolEntries().map((entry) =>
      summary('SYMBOL', {
        id: entry.id,
        ...(entry.version === undefined ? {} : { version: entry.version }),
        label: entry.name,
        category: entry.semanticType,
      }),
    ),
  ];
}

const FILES: readonly {
  readonly registry: DataRegistry;
  readonly sources: readonly string[];
  readonly formatVersion: string;
  readonly entries: readonly unknown[];
}[] = [
  {
    registry: 'EQUIPMENT',
    sources: equipmentCatalogSources(),
    formatVersion: CATALOG_FORMAT_VERSION,
    entries: rawGenericEquipmentEntries(),
  },
  {
    registry: 'MATERIAL',
    sources: materialCatalogSources(),
    formatVersion: GENERIC_MATERIAL_FORMAT_VERSION,
    entries: rawGenericMaterialEntries(),
  },
  {
    registry: 'OPENING',
    sources: openingCatalogSources(),
    formatVersion: GENERIC_OPENING_FORMAT_VERSION,
    entries: rawGenericOpeningEntries(),
  },
  {
    registry: 'ASSEMBLY',
    sources: assemblyCatalogSources(),
    formatVersion: GENERIC_ASSEMBLY_FORMAT_VERSION,
    entries: rawGenericAssemblyEntries(),
  },
  {
    registry: 'NETWORK_PRODUCT',
    sources: networkProductCatalogSources(),
    formatVersion: CATALOG_FORMAT_VERSION,
    entries: NETWORK_PRODUCT_REGISTRY,
  },
  {
    registry: 'SYMBOL',
    sources: symbolCatalogSources(),
    formatVersion: GENERIC_SYMBOL_FORMAT_VERSION,
    entries: rawGenericSymbolEntries(),
  },
];

/** What each installed catalogue file says about itself, right now. */
export function catalogManifestEntries(): readonly CatalogManifestEntry[] {
  return FILES.map(({ registry, sources, formatVersion, entries }) => ({
    registry,
    // Every file found, not a path somebody typed: a manifest naming one file
    // of a folder that now holds twenty describes a previous release.
    sources,
    entryCount: entries.length,
    formatVersion,
    fingerprint: contentFingerprint(entries),
  }));
}

/**
 * The manifest as the shipped data actually is.
 *
 * The release identifier is derived from the files rather than typed: a number
 * somebody has to remember to raise is a number that will disagree with the
 * data it names, and the whole point of a release is to be able to say « this
 * is what you have ».
 */
export function currentCatalogManifest(): CatalogManifest {
  const generatedFrom = catalogManifestEntries();
  return {
    catalogFormatVersion: CATALOG_FORMAT_VERSION,
    releaseId: contentFingerprint(
      generatedFrom.map(
        ({ registry, fingerprint }) => `${registry}:${fingerprint}`,
      ),
    ),
    generatedFrom,
  };
}

/** The catalogues this application ships, as one thing to ask. */
export function installedCatalog(): CatalogRepository {
  const bodies = new Map<string, unknown>();
  const put = (
    registry: DataRegistry,
    entries: readonly { readonly id: string; readonly version?: string }[],
  ) => {
    for (const entry of entries)
      bodies.set(`${registry}:${entry.id}@${entry.version ?? ''}`, entry);
  };
  put('EQUIPMENT', genericCatalog());
  put('MATERIAL', rawGenericMaterialEntries());
  put('OPENING', rawGenericOpeningEntries());
  put('ASSEMBLY', rawGenericAssemblyEntries());
  put('NETWORK_PRODUCT', NETWORK_PRODUCT_REGISTRY);
  put('SYMBOL', rawGenericSymbolEntries());
  return bundledCatalogRepository(
    currentCatalogManifest(),
    catalogSummaries(),
    bodies,
  );
}

/**
 * How many entries each family has, and how many pass its gate.
 *
 * Read off the summaries, which already carry the answer, so that a browser
 * never has to hold a fiche to count one.
 */
export function catalogEvidence(
  summaries: readonly CatalogSummary[] = catalogSummaries(),
): ReadonlyMap<string, FamilyEvidence> {
  const counted = new Map<string, { entryCount: number; cleanCount: number }>();
  for (const summary of summaries) {
    if (summary.familyId === undefined) continue;
    const held = counted.get(summary.familyId) ?? {
      entryCount: 0,
      cleanCount: 0,
    };
    held.entryCount += 1;
    if (summary.valid) held.cleanCount += 1;
    counted.set(summary.familyId, held);
  }
  return counted;
}
