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

/**
 * A schema as a data file states it, before anything has been checked.
 *
 * The strict type says `type: PropertyType` and `source: PropertySource`; a
 * JSON file says `string`, and the difference between the two is exactly what
 * validation earns.
 */
export interface PropertySchemaCandidate {
  readonly family: string;
  readonly properties: readonly (Omit<PropertyDescriptor, 'type' | 'source'> & {
    readonly type: string;
    readonly source: string;
  })[];
}

/**
 * Everything wrong with one schema, before anything is measured against it.
 *
 * A schema is what tells a catalogue entry it is wrong; a schema that is
 * itself wrong tells it nothing, and does it quietly. An enum with no options
 * accepts every string, a minimum above its maximum accepts no number at all,
 * and a key declared twice means the second declaration silently wins — none
 * of which any entry can reveal, because the entries are checked *by* this.
 */
export function validatePropertySchema(
  schema: PropertySchemaCandidate,
): readonly PropertyIssue[] {
  const issues: PropertyIssue[] = [];
  const at = (path: string, message: string) => issues.push({ path, message });
  if (schema.family.trim() === '') at('family', 'must not be empty');
  const seen = new Set<string>();
  for (const [index, property] of schema.properties.entries()) {
    const where =
      property.key.trim() === '' ? `properties/${index}` : property.key;
    if (property.key.trim() === '') at(where, 'must have a key');
    else if (seen.has(property.key)) at(where, 'is declared more than once');
    seen.add(property.key);
    if (property.label.trim() === '') at(where, 'must have a label');
    if (!(PROPERTY_TYPES as readonly string[]).includes(property.type))
      at(where, `unknown type ${property.type}`);
    if (!(PROPERTY_SOURCES as readonly string[]).includes(property.source))
      at(where, `unknown source ${property.source}`);
    if (property.type === 'enum' && (property.options ?? []).length === 0)
      at(where, 'is an enum and names no value it accepts');
    if (property.type !== 'enum' && property.options !== undefined)
      at(where, 'names accepted values but is not an enum');
    for (const [bound, value] of [
      ['minimum', property.minimum],
      ['maximum', property.maximum],
    ] as const)
      if (value !== undefined && !Number.isFinite(value))
        at(`${where}/${bound}`, 'must be a finite number');
    if (
      property.minimum !== undefined &&
      property.maximum !== undefined &&
      property.minimum > property.maximum
    )
      at(where, 'has a minimum above its maximum, which nothing can satisfy');
    // A number without a unit is a number nobody can read back: 3 what?
    if (
      (property.type === 'number' || property.type === 'integer') &&
      (property.unit ?? '').trim() === ''
    )
      at(where, 'is a number and states no unit');
  }
  return issues;
}
