declare const materialIdBrand: unique symbol;

export type MaterialId = string & { readonly [materialIdBrand]: true };
export type MaterialKind = 'GENERIC' | 'PRODUCT' | 'CUSTOM';
export type MaterialSourceType =
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
