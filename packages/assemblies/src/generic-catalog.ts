import { assemblyId, assemblyLayerId } from './assemblies.js';
import { materialId } from '@house-technical-designer/materials';
import type { Assembly, AssemblyCategory, LayerRole } from './types.js';

/**
 * The build-ups a project can start from.
 *
 * There was no assembly catalogue at all: the seven registries listed one, the
 * nomenclature declared fifty-six families of it, and nothing shipped a single
 * entry — so every project began by asking somebody to compose a wall layer by
 * layer before they could draw one. A build-up is exactly the kind of thing a
 * catalogue is for: everybody's external wall is one of six, and the sixth is
 * the interesting one.
 */
export interface RawAssemblyEntry {
  readonly id: string;
  readonly familyId: string;
  /**
   * The coarse grouping, as the family states it.
   *
   * Written here too, and checked at the gate to say the same thing. The same
   * snapshot argument as a material's: the first screen groups build-ups
   * before anything is drawn, and reaching for five hundred families to do it
   * would load all of them first.
   */
  readonly category: string;
  readonly name: string;
  readonly version: string;
  readonly provenance: {
    readonly type: string;
    readonly reference: string;
    readonly url?: string;
    readonly validAt?: string;
  };
  /** Exterior to interior, for anything vertical. The order is the build-up. */
  readonly layers: readonly {
    readonly id: string;
    readonly materialId: string;
    readonly thicknessM: number;
    readonly role?: string;
    readonly ventilated?: boolean;
  }[];
}

interface CatalogFile {
  readonly formatVersion: string;
  readonly assemblies: readonly RawAssemblyEntry[];
}

/**
 * Every build-up file under `data`, found rather than listed.
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
export function assemblyCatalogSources(): readonly string[] {
  return Object.keys(DISCOVERED)
    .map((path) => path.replace('../', 'packages/assemblies/'))
    .sort();
}

/** Every entry as the files state them, unchecked and unrepaired. */
export function rawGenericAssemblyEntries(): readonly RawAssemblyEntry[] {
  return FILES.flatMap(({ assemblies }) => assemblies);
}

/** What the catalogue files themselves are: their shape has a version too. */
export const GENERIC_ASSEMBLY_FORMAT_VERSION =
  FILES[0]?.formatVersion ?? '1.0.0';

/** The catalogue as the model holds it. */
export function genericAssemblyCatalog(): readonly Assembly[] {
  return rawGenericAssemblyEntries().map((entry) => ({
    id: assemblyId(entry.id),
    // Where this build-up came from, so a project can still say it.
    catalogRef: {
      registry: 'ASSEMBLY' as const,
      id: entry.id,
      version: entry.version,
    },
    name: entry.name,
    category: entry.category as AssemblyCategory,
    layers: entry.layers.map((layer) => ({
      id: assemblyLayerId(layer.id),
      materialId: materialId(layer.materialId),
      thicknessM: layer.thicknessM,
      ...(layer.role === undefined ? {} : { role: layer.role as LayerRole }),
      ...(layer.ventilated === undefined
        ? {}
        : { ventilated: layer.ventilated }),
    })),
  }));
}

/** The family of the master nomenclature one generic build-up belongs to. */
export function genericAssemblyFamily(id: string): string | undefined {
  return rawGenericAssemblyEntries().find((entry) => entry.id === id)?.familyId;
}
