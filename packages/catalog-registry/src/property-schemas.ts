/**
 * Where the value of one property comes from.
 *
 * The distinction is the whole point. A rated heating power belongs to the
 * catalogue entry and is the same for every heat pump of that model; a mounting
 * height belongs to the one standing in this house; a design flow is worked out
 * from the two and is never stored. Writing all three into the same record is
 * how a project ends up with a design flow that disagrees with the pipe it
 * sizes.
 */
export const PROPERTY_SOURCES = ['DEFINITION', 'INSTANCE', 'DERIVED'] as const;
export type PropertySource = (typeof PROPERTY_SOURCES)[number];

export const PROPERTY_TYPES = [
  'number',
  'integer',
  'string',
  'boolean',
  'enum',
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/**
 * What one property of one family is.
 *
 * One description, from which the validation, the inspector, the catalogue
 * forms, the units, the import and the export are all produced. Four places
 * describing the same field is four places to forget one of them.
 */
export interface PropertyDescriptor {
  readonly key: string;
  readonly label: string;
  readonly type: PropertyType;
  /** SI or the unit the trade actually writes; `-` for a ratio. */
  readonly unit?: string;
  readonly required?: boolean;
  readonly source: PropertySource;
  /** Values the property accepts, when it is an enum. */
  readonly options?: readonly string[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly hint?: string;
}

/** Everything one family declares about its own properties. */
export interface PropertySchema {
  readonly family: string;
  readonly properties: readonly PropertyDescriptor[];
}

export type PropertyValue = string | number | boolean;

export interface PropertyIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * Checks a set of values against what a family says its properties are.
 *
 * A derived property found among the stored values is an error and not a
 * warning: it is a second answer to a question the model already answers, and
 * the two will disagree the first time anything moves.
 */
export function validateProperties(
  schema: PropertySchema,
  values: Readonly<Record<string, PropertyValue>>,
  source: PropertySource,
): readonly PropertyIssue[] {
  const issues: PropertyIssue[] = [];
  const declared = new Map(
    schema.properties.map((property) => [property.key, property]),
  );
  for (const property of schema.properties) {
    if (property.source !== source) continue;
    const value = values[property.key];
    if (value === undefined) {
      if (property.required === true)
        issues.push({
          path: property.key,
          message: `${schema.family} requires ${property.key}`,
        });
      continue;
    }
    issues.push(...invalid(property, value));
  }
  for (const key of Object.keys(values)) {
    const property = declared.get(key);
    if (property === undefined) {
      issues.push({
        path: key,
        message: `${schema.family} declares no property ${key}`,
      });
      continue;
    }
    if (property.source === 'DERIVED')
      issues.push({
        path: key,
        message: `${key} is derived and must not be stored`,
      });
    else if (property.source !== source)
      issues.push({
        path: key,
        message: `${key} belongs to the ${property.source.toLowerCase()}, not to the ${source.toLowerCase()}`,
      });
  }
  return issues;
}

function invalid(
  property: PropertyDescriptor,
  value: PropertyValue,
): readonly PropertyIssue[] {
  const at = (message: string) => [{ path: property.key, message }];
  switch (property.type) {
    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value))
        return at(`${property.key} must be a whole number`);
      return outOfRange(property, value);
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value))
        return at(`${property.key} must be a finite number`);
      return outOfRange(property, value);
    case 'boolean':
      return typeof value === 'boolean'
        ? []
        : at(`${property.key} must be true or false`);
    case 'enum':
      return typeof value === 'string' &&
        (property.options ?? []).includes(value)
        ? []
        : at(
            `${property.key} must be one of ${(property.options ?? []).join(', ')}`,
          );
    case 'string':
      return typeof value === 'string' && value.trim() !== ''
        ? []
        : at(`${property.key} must be a non-empty string`);
  }
}

function outOfRange(
  property: PropertyDescriptor,
  value: number,
): readonly PropertyIssue[] {
  if (property.minimum !== undefined && value < property.minimum)
    return [
      {
        path: property.key,
        message: `${property.key} must be at least ${property.minimum}`,
      },
    ];
  if (property.maximum !== undefined && value > property.maximum)
    return [
      {
        path: property.key,
        message: `${property.key} must be at most ${property.maximum}`,
      },
    ];
  return [];
}
