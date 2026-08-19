import type {
  Material,
  MaterialId,
  MaterialProperties,
  MaterialSource,
  MaterialValidationIssue,
} from './types.js';

export function materialId(value: string): MaterialId {
  if (value.trim().length === 0)
    throw new TypeError('Material ID must not be empty');
  return value as MaterialId;
}

function cloneJson<T>(value: T): T {
  return structuredClone(value);
}

/** Creates a detached, readonly-typed snapshot suitable for a project file. */
export function createMaterial(definition: Material): Material {
  const snapshot: Material = cloneJson(definition);
  const issues = validateMaterial(snapshot);
  if (issues.length > 0) {
    throw new RangeError(
      issues.map(({ path, message }) => `${path}: ${message}`).join('; '),
    );
  }
  return snapshot;
}

export function createCustomMaterial(
  id: MaterialId,
  name: string,
  properties: MaterialProperties = {},
  sources: readonly MaterialSource[] = [],
): Material {
  return createMaterial({ id, name, kind: 'CUSTOM', properties, sources });
}

/** Duplicating is the only supported way to edit a system catalog material. */
export function duplicateAsCustom(
  source: Material,
  id: MaterialId,
  name = source.name,
): Material {
  return createMaterial({
    ...source,
    id,
    name,
    kind: 'CUSTOM',
    properties: cloneJson(source.properties),
    ...(source.sources === undefined
      ? {}
      : { sources: cloneJson(source.sources) }),
  });
}

export function validateMaterial(
  material: Material,
): readonly MaterialValidationIssue[] {
  const issues: MaterialValidationIssue[] = [];
  if (material.id.trim().length === 0)
    issues.push({ path: 'id', message: 'must not be empty' });
  if (material.name.trim().length === 0)
    issues.push({ path: 'name', message: 'must not be empty' });

  positive(issues, material.properties.densityKgM3, 'properties.densityKgM3');
  positive(
    issues,
    material.properties.specificHeatJKgK,
    'properties.specificHeatJKgK',
  );
  positive(issues, material.properties.lambdaWmK, 'properties.lambdaWmK');
  bounded(
    issues,
    material.properties.emissivity,
    0,
    1,
    'properties.emissivity',
  );
  positive(issues, material.properties.mu, 'properties.mu');
  bounded(
    issues,
    material.properties.sdM,
    0,
    Number.POSITIVE_INFINITY,
    'properties.sdM',
  );

  for (const [band, coefficient] of Object.entries(
    material.properties.acousticAbsorption ?? {},
  )) {
    bounded(issues, coefficient, 0, 1, `properties.acousticAbsorption.${band}`);
  }
  for (const [index, source] of (material.sources ?? []).entries()) {
    if (source.property.trim().length === 0) {
      issues.push({
        path: `sources[${index}].property`,
        message: 'must not be empty',
      });
    }
  }
  return issues;
}

function positive(
  issues: MaterialValidationIssue[],
  value: number | undefined,
  path: string,
): void {
  if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
    issues.push({ path, message: 'must be a finite number greater than zero' });
  }
}

function bounded(
  issues: MaterialValidationIssue[],
  value: number | undefined,
  minimum: number,
  maximum: number,
  path: string,
): void {
  if (
    value !== undefined &&
    (!Number.isFinite(value) || value < minimum || value > maximum)
  ) {
    issues.push({ path, message: `must be between ${minimum} and ${maximum}` });
  }
}
