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
  'STRUCTURAL_MEMBER',
  'ROOF_PART',
  'OTHER',
] as const;
export type AssemblyCategory = (typeof ASSEMBLY_CATEGORIES)[number];

export function isAssemblyCategory(value: string): value is AssemblyCategory {
  return (ASSEMBLY_CATEGORIES as readonly string[]).includes(value);
}
/**
 * How a catalogue entry of this registry describes what it is.
 *
 * A build-up is a stack: materials one behind another, each with a thickness,
 * from the outside in. That is the right description of a wall, a floor or a
 * roof — of anything with two faces and something between them — and it is the
 * wrong description of everything else the registry was asked to hold.
 *
 * A column has no thickness, it has a section. A ridge has no faces, it has a
 * length. Writing either as « one layer of concrete, 0.20 m » would pass the
 * gate, draw on the plan, and be read by the thermal calculation as a wall of
 * 0.20 m of concrete — a wall that does not exist, with an area that does not
 * exist. CG-01 and CG-02 wrote that down rather than letting it happen; this
 * is the discriminator that makes the three kinds impossible to confuse.
 */
export const ASSEMBLY_FORMS = ['LAYERED', 'PROFILED', 'LINEAR'] as const;
export type AssemblyForm = (typeof ASSEMBLY_FORMS)[number];

export function isAssemblyForm(value: string): value is AssemblyForm {
  return (ASSEMBLY_FORMS as readonly string[]).includes(value);
}

/** The form the registry expects of an entry of this category. */
export function assemblyFormOfCategory(category: string): AssemblyForm {
  if (category === 'STRUCTURAL_MEMBER') return 'PROFILED';
  if (category === 'ROOF_PART') return 'LINEAR';
  return 'LAYERED';
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
  /**
   * Which of the three descriptions this entry uses.
   *
   * Absent means `LAYERED`, because every build-up written before the
   * discriminator existed is one, and a default that has to be spelled out in
   * thirty-five files is a migration nobody asked for.
   */
  readonly form?: AssemblyForm;
  /** Layer order is significant (exterior to interior for vertical assemblies). */
  readonly layers: readonly AssemblyLayer[];
  /**
   * What a profiled or linear entry states about itself.
   *
   * Governed by the property schema its family names, exactly like an
   * equipment fiche: a section, a material, a fire rating. A layered build-up
   * carries none — its layers say everything, and a second place to say it is
   * a second answer that stops agreeing.
   */
  readonly properties?: Readonly<Record<string, string | number | boolean>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Whether this build-up is the kind a wall, a floor or a roof can be made of. */
export function isLayeredAssembly(assembly: {
  readonly form?: AssemblyForm;
}): boolean {
  return (assembly.form ?? 'LAYERED') === 'LAYERED';
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
