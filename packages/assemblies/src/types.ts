import type { MaterialId } from '@house-technical-designer/materials';

declare const assemblyIdBrand: unique symbol;
declare const layerIdBrand: unique symbol;

export type AssemblyId = string & { readonly [assemblyIdBrand]: true };
export type AssemblyLayerId = string & { readonly [layerIdBrand]: true };
export type AssemblyCategory =
  | 'WALL'
  | 'ROOF'
  | 'FLOOR'
  | 'CEILING'
  | 'PARTITION'
  | 'OTHER';
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
