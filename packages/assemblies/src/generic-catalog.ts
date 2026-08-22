import generic from '../data/generic.json' with { type: 'json' };
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

/** Every entry as the file states it, unchecked and unrepaired. */
export function rawGenericAssemblyEntries(): readonly RawAssemblyEntry[] {
  return (generic as CatalogFile).assemblies;
}

/** What the catalogue file itself is: its own shape has a version too. */
export const GENERIC_ASSEMBLY_FORMAT_VERSION = (generic as CatalogFile)
  .formatVersion;

/** The catalogue as the model holds it. */
export function genericAssemblyCatalog(): readonly Assembly[] {
  return rawGenericAssemblyEntries().map((entry) => ({
    id: assemblyId(entry.id),
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
