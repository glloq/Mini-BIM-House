declare const materialIdBrand: unique symbol;

export type MaterialId = string & { readonly [materialIdBrand]: true };
export type MaterialKind = 'GENERIC' | 'PRODUCT' | 'CUSTOM';

/**
 * The coarse grouping a material falls into, as the family states it.
 *
 * A closed list, and stated once: the catalogue used to carry a category on
 * every entry, beside a family that says the same thing. What the interface
 * sorts and filters by now comes from the nomenclature, like everything else.
 */
export const MATERIAL_CATEGORIES = [
  'STRUCTURE',
  'MASONRY',
  'WOOD',
  'INSULATION',
  'FINISH',
  'MEMBRANE',
  'GLAZING',
  'METAL',
  'AIR',
  'OTHER',
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export function isMaterialCategory(value: string): value is MaterialCategory {
  return (MATERIAL_CATEGORIES as readonly string[]).includes(value);
}
/**
 * Where a material's figure comes from.
 *
 * `GENERIC` was missing, so the generic catalogue had to call its own
 * order-of-magnitude values `STANDARD` — a design figure wearing a standard's
 * authority, which is the one thing the traceability rule exists to prevent.
 * It is not a lesser status: most of a first catalogue is generic.
 */
export type MaterialSourceType =
  | 'GENERIC'
  | 'STANDARD'
  | 'MANUFACTURER'
  | 'DATABASE'
  | 'USER'
  | 'CALCULATED'
  | 'OTHER';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** Schema-defined properties plus extension properties retained losslessly. */
export interface MaterialProperties {
  readonly densityKgM3?: number;
  readonly specificHeatJKgK?: number;
  readonly lambdaWmK?: number;
  readonly emissivity?: number;
  readonly mu?: number;
  readonly sdM?: number;
  readonly acousticAbsorption?: Readonly<Record<string, number>>;
  readonly [property: string]: JsonValue | undefined;
}

export interface MaterialSource {
  readonly property: string;
  readonly sourceType: MaterialSourceType;
  readonly reference?: string;
  readonly url?: string;
  readonly validAt?: string;
  readonly [extension: string]: JsonValue | undefined;
}

export interface MaterialAppearance {
  readonly hatchId?: string;
  readonly fillToken?: string;
  readonly [extension: string]: JsonValue | undefined;
}

export interface Material {
  readonly id: MaterialId;
  readonly name: string;
  readonly kind: MaterialKind;
  readonly category?: string;
  readonly manufacturer?: string;
  readonly properties: MaterialProperties;
  readonly sources?: readonly MaterialSource[];
  readonly appearance?: MaterialAppearance;
}

export interface MaterialValidationIssue {
  readonly path: string;
  readonly message: string;
}
