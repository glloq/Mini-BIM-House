import { createMaterial, materialId } from './materials.js';
import type {
  JsonValue,
  Material,
  MaterialKind,
  MaterialProperties,
  MaterialSource,
  MaterialSourceType,
} from './types.js';

export type MaterialParseResult =
  | { readonly status: 'OK'; readonly material: Material }
  | { readonly status: 'INVALID'; readonly errors: readonly string[] };

const MATERIAL_KINDS: readonly MaterialKind[] = [
  'GENERIC',
  'PRODUCT',
  'CUSTOM',
];
const SOURCE_TYPES: readonly MaterialSourceType[] = [
  'STANDARD',
  'MANUFACTURER',
  'DATABASE',
  'USER',
  'CALCULATED',
  'OTHER',
];

export function parseMaterial(value: unknown): MaterialParseResult {
  if (!isRecord(value))
    return { status: 'INVALID', errors: ['material must be an object'] };
  const errors: string[] = [];
  const id =
    typeof value.id === 'string' && value.id.trim() !== ''
      ? value.id
      : undefined;
  const name =
    typeof value.name === 'string' && value.name.trim() !== ''
      ? value.name
      : undefined;
  const kind = isMaterialKind(value.kind) ? value.kind : undefined;
  if (id === undefined) errors.push('id must be a non-empty string');
  if (name === undefined) errors.push('name must be a non-empty string');
  if (kind === undefined) errors.push('kind is not supported');
  const properties = parseProperties(value.properties, errors);
  const sources = parseSources(value.sources, errors);
  if (value.category !== undefined && typeof value.category !== 'string')
    errors.push('category must be a string');
  if (
    value.manufacturer !== undefined &&
    typeof value.manufacturer !== 'string'
  )
    errors.push('manufacturer must be a string');
  if (
    errors.length > 0 ||
    properties === undefined ||
    id === undefined ||
    name === undefined ||
    kind === undefined
  )
    return { status: 'INVALID', errors };
  const definition: Material = {
    id: materialId(id),
    name,
    kind,
    properties,
    ...(typeof value.category === 'string' ? { category: value.category } : {}),
    ...(typeof value.manufacturer === 'string'
      ? { manufacturer: value.manufacturer }
      : {}),
    ...(sources === undefined ? {} : { sources }),
  };
  try {
    return { status: 'OK', material: createMaterial(definition) };
  } catch (error: unknown) {
    return {
      status: 'INVALID',
      errors: [error instanceof Error ? error.message : 'Invalid material.'],
    };
  }
}

function parseProperties(
  value: unknown,
  errors: string[],
): MaterialProperties | undefined {
  if (!isRecord(value)) {
    errors.push('properties must be an object');
    return undefined;
  }
  const result: Record<string, JsonValue> = {};
  for (const [key, property] of Object.entries(value)) {
    if (!isJsonValue(property))
      errors.push(`properties.${key} must be a JSON value`);
    else result[key] = structuredClone(property);
  }
  return result;
}

function parseSources(
  value: unknown,
  errors: string[],
): readonly MaterialSource[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    errors.push('sources must be an array');
    return undefined;
  }
  const sources: MaterialSource[] = [];
  value.forEach((source, index) => {
    if (
      !isRecord(source) ||
      typeof source.property !== 'string' ||
      !isSourceType(source.sourceType)
    ) {
      errors.push(`sources[${index}] is invalid`);
      return;
    }
    const parsed: MaterialSource = {
      property: source.property,
      sourceType: source.sourceType,
      ...(typeof source.reference === 'string'
        ? { reference: source.reference }
        : {}),
      ...(typeof source.url === 'string' ? { url: source.url } : {}),
      ...(typeof source.validAt === 'string'
        ? { validAt: source.validAt }
        : {}),
    };
    sources.push(parsed);
  });
  return sources;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMaterialKind(value: unknown): value is MaterialKind {
  return (
    typeof value === 'string' && MATERIAL_KINDS.some((kind) => kind === value)
  );
}

function isSourceType(value: unknown): value is MaterialSourceType {
  return (
    typeof value === 'string' &&
    SOURCE_TYPES.some((sourceType) => sourceType === value)
  );
}
