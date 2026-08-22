import type { CatalogRef } from '@house-technical-designer/technical-types';
import type { MaterialId } from '@house-technical-designer/materials';

declare const assemblyIdBrand: unique symbol;
declare const layerIdBrand: unique symbol;

export type AssemblyId = string & { readonly [assemblyIdBrand]: true };
export type AssemblyLayerId = string & { readonly [layerIdBrand]: true };
/**
 * The coarse grouping a build-up falls into, as its family states it.
 *
 * A closed list, and stated once: the family says it, the entry does not
 * repeat it, and the interface groups by what the nomenclature says.
 */
export const ASSEMBLY_CATEGORIES = [
  'WALL',
  'ROOF',
  'FLOOR',
  'CEILING',
  'PARTITION',
  'OTHER',
] as const;
export type AssemblyCategory = (typeof ASSEMBLY_CATEGORIES)[number];

export function isAssemblyCategory(value: string): value is AssemblyCategory {
  return (ASSEMBLY_CATEGORIES as readonly string[]).includes(value);
}
export type LayerRole =
  | 'FINISH'
  | 'STRUCTURAL'
  | 'INSULATION'
  | 'MEMBRANE'
  | 'SERVICE_CAVITY'
  | 'AIR_GAP'
  | 'CLADDING'
  | 'WATERPROOFING'
  | 'OTHER';

export interface AssemblyLayer {
  readonly id: AssemblyLayerId;
  readonly materialId: MaterialId;
  /** Persisted in SI to match assembly.schema.json. */
  readonly thicknessM: number;
  readonly role?: LayerRole;
  readonly ventilated?: boolean;
}

export interface Assembly {
  readonly id: AssemblyId;
  /**
   * The catalogue entry this build-up was taken from.
   *
   * Same argument as a material's: the layers are the project's truth and stay
   * reproducible on their own, and this says where they came from —
   * `ASSEMBLY:generic-partition-stud@1.0.0`. Optional, because a build-up
   * composed by hand comes from nowhere.
   */
  readonly catalogRef?: CatalogRef;
  readonly name: string;
  readonly category: AssemblyCategory;
  /** Layer order is significant (exterior to interior for vertical assemblies). */
  readonly layers: readonly AssemblyLayer[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type AssemblyIssueCode =
  | 'EMPTY_ID'
  | 'EMPTY_NAME'
  | 'NO_LAYERS'
  | 'DUPLICATE_LAYER_ID'
  | 'INVALID_THICKNESS'
  | 'MISSING_MATERIAL';

export interface AssemblyIssue {
  readonly code: AssemblyIssueCode;
  readonly path: string;
  readonly message: string;
}
