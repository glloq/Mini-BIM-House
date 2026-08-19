import { createCustomMaterial } from './materials.js';
import type {
  Material,
  MaterialId,
  MaterialKind,
  MaterialProperties,
  MaterialSource,
} from './types.js';

export type KnownMaterialProperty =
  | 'densityKgM3'
  | 'specificHeatJKgK'
  | 'lambdaWmK'
  | 'emissivity'
  | 'mu'
  | 'sdM';

export interface MaterialFilter {
  readonly search?: string;
  readonly kinds?: readonly MaterialKind[];
  readonly categories?: readonly string[];
  readonly manufacturer?: string;
  readonly requiredProperties?: readonly KnownMaterialProperty[];
  readonly missingPropertiesOnly?: boolean;
}

export interface MaterialEditorRow {
  readonly material: Material;
  readonly missingProperties: readonly KnownMaterialProperty[];
  readonly sourcedProperties: readonly string[];
  readonly unsourcedProperties: readonly string[];
}

export interface CustomMaterialDraft {
  readonly id: MaterialId;
  readonly name: string;
  readonly category?: string;
  readonly manufacturer?: string;
  readonly properties?: MaterialProperties;
  readonly sources?: readonly MaterialSource[];
}

export type CustomMaterialDraftResult =
  | { readonly status: 'OK'; readonly material: Material }
  | { readonly status: 'INVALID'; readonly errors: readonly string[] };

export function queryMaterials(
  materials: readonly Material[],
  filter: MaterialFilter = {},
): readonly MaterialEditorRow[] {
  const required = filter.requiredProperties ?? [];
  const search = normalize(filter.search ?? '');
  return materials
    .map((material) => toEditorRow(material, required))
    .filter(
      ({ material }) =>
        search === '' || searchableText(material).includes(search),
    )
    .filter(
      ({ material }) =>
        filter.kinds === undefined || filter.kinds.includes(material.kind),
    )
    .filter(
      ({ material }) =>
        filter.categories === undefined ||
        (material.category !== undefined &&
          filter.categories.includes(material.category)),
    )
    .filter(
      ({ material }) =>
        filter.manufacturer === undefined ||
        normalize(material.manufacturer ?? '') ===
          normalize(filter.manufacturer),
    )
    .filter(
      ({ missingProperties }) =>
        filter.missingPropertiesOnly !== true || missingProperties.length > 0,
    )
    .sort(
      (first, second) =>
        first.material.name.localeCompare(second.material.name, 'en') ||
        first.material.id.localeCompare(second.material.id, 'en'),
    );
}

export function createCustomMaterialFromDraft(
  draft: CustomMaterialDraft,
): CustomMaterialDraftResult {
  const errors: string[] = [];
  if (draft.name.trim() === '') errors.push('name must not be empty');
  const sources = draft.sources ?? [];
  const properties = draft.properties ?? {};
  for (const [index, source] of sources.entries()) {
    if (properties[source.property] === undefined)
      errors.push(
        `sources[${index}].property does not reference a known material value`,
      );
  }
  if (errors.length > 0) return { status: 'INVALID', errors };
  try {
    const base = createCustomMaterial(
      draft.id,
      draft.name,
      properties,
      sources,
    );
    return {
      status: 'OK',
      material: {
        ...base,
        ...(draft.category === undefined ? {} : { category: draft.category }),
        ...(draft.manufacturer === undefined
          ? {}
          : { manufacturer: draft.manufacturer }),
      },
    };
  } catch (error: unknown) {
    return {
      status: 'INVALID',
      errors: [
        error instanceof Error ? error.message : 'Invalid custom material.',
      ],
    };
  }
}

function toEditorRow(
  material: Material,
  required: readonly KnownMaterialProperty[],
): MaterialEditorRow {
  const definedProperties = Object.keys(material.properties).filter(
    (property) => material.properties[property] !== undefined,
  );
  const sourced = new Set(
    (material.sources ?? []).map(({ property }) => property),
  );
  return {
    material,
    missingProperties: required.filter(
      (property) => material.properties[property] === undefined,
    ),
    sourcedProperties: definedProperties
      .filter((property) => sourced.has(property))
      .sort(),
    unsourcedProperties: definedProperties
      .filter((property) => !sourced.has(property))
      .sort(),
  };
}

function searchableText(material: Material): string {
  return normalize(
    [material.name, material.category, material.manufacturer, material.id]
      .filter((value): value is string => value !== undefined)
      .join(' '),
  );
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en')
    .trim();
}
