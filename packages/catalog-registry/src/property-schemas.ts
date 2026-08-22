import {
  isWrittenUnit,
  quantityOf,
} from '@house-technical-designer/technical-types';
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
  /**
   * A value per octave band, which is how the acoustic trade tabulates
   * everything it measures.
   *
   * Absorption is not a number: a carpet swallows 0,60 at 4 kHz and 0,03 at
   * 125 Hz, and a single figure is either one of the eight or an average
   * nobody can trace back. The material catalogue already held it as a record
   * band by band, outside every schema and therefore checked by nothing — a
   * band could be missing, a coefficient could be 1,4, and both files stayed
   * valid on their own.
   */
  'spectrum',
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/**
 * One property, defined once for the whole application.
 *
 * `cost` meant four different things — a cost, a cost per square metre, a cost
 * per metre and a cost per cubic metre — and `pressureDrop` was a stored value
 * in one schema and a derived one in another, which is how a derived figure
 * ends up written into a file and disagreeing with itself. Two hundred and
 * forty-six keys spread over forty-four schemas had drifted eleven times
 * already; at five hundred families it would not be recoverable.
 *
 * So a key is defined here and nowhere else: what it means, what type it is,
 * what it is measured in. A family then says which of them it uses and what it
 * accepts — a range, a list — and repeats none of the rest.
 */
export interface PropertyDefinition {
  readonly id: string;
  readonly label: string;
  readonly type: PropertyType;
  /** SI or the unit the trade actually writes; `-` for a ratio. */
  readonly unit?: string;
  /** What the unit measures, which is what makes a conversion possible. */
  readonly quantity?: string;
  /** What the trade reads, when that is not what is stored. */
  readonly displayUnit?: string;
  /** Older spellings of this key, so a file written with one still opens. */
  readonly aliases?: readonly string[];
  readonly hint?: string;
}

/**
 * What one family says about a property it uses.
 *
 * The key, where the value comes from, and what this family accepts. The
 * meaning, the type and the unit are the property's, not the family's.
 */
export interface PropertyConstraint {
  readonly key: string;
  readonly source: PropertySource;
  readonly required?: boolean;
  /** The values this family accepts, when it accepts fewer than the type. */
  readonly options?: readonly string[];
  readonly minimum?: number;
  readonly maximum?: number;
}

/**
 * A property as everything downstream reads it: the definition and the
 * family's constraint seen together.
 */
export interface PropertyDescriptor {
  readonly key: string;
  readonly label: string;
  readonly type: PropertyType;
  readonly unit?: string;
  readonly quantity?: string;
  readonly displayUnit?: string;
  readonly required?: boolean;
  readonly source: PropertySource;
  readonly options?: readonly string[];
  readonly minimum?: number;
  readonly maximum?: number;
  /** Older spellings of this key, so a file written with one still opens. */
  readonly aliases?: readonly string[];
  readonly hint?: string;
}

/** The definition and the constraint, seen together. */
export function describedProperty(
  definition: PropertyDefinition,
  constraint: PropertyConstraint,
): PropertyDescriptor {
  return {
    key: constraint.key,
    label: definition.label,
    type: definition.type,
    ...(definition.unit === undefined ? {} : { unit: definition.unit }),
    ...(definition.quantity === undefined
      ? {}
      : { quantity: definition.quantity }),
    ...(definition.displayUnit === undefined
      ? {}
      : { displayUnit: definition.displayUnit }),
    ...(constraint.required === undefined
      ? {}
      : { required: constraint.required }),
    source: constraint.source,
    ...(constraint.options === undefined
      ? {}
      : { options: constraint.options }),
    ...(constraint.minimum === undefined
      ? {}
      : { minimum: constraint.minimum }),
    ...(constraint.maximum === undefined
      ? {}
      : { maximum: constraint.maximum }),
    ...(definition.aliases === undefined
      ? {}
      : { aliases: definition.aliases }),
    ...(definition.hint === undefined ? {} : { hint: definition.hint }),
  };
}

/** Everything one family declares about its own properties. */
export interface PropertySchema {
  readonly family: string;
  readonly properties: readonly PropertyDescriptor[];
}

/** A schema as its file states it: keys and constraints, nothing repeated. */
export interface PropertySchemaFile {
  readonly family: string;
  readonly properties: readonly PropertyConstraint[];
}

/** A value per octave band, in hertz: `{ '125': 0.03, '250': 0.04, ... }`. */
export type Spectrum = Readonly<Record<string, number>>;

export type PropertyValue = string | number | boolean | Spectrum;

/**
 * The bands a spectrum may be given in.
 *
 * The eight octave bands the building trades measure and publish. Closed on
 * purpose: a coefficient filed at 300 Hz is a coefficient no standard, no
 * calculation and no other fiche will ever line up against.
 */
export const OCTAVE_BANDS_HZ = [
  '63',
  '125',
  '250',
  '500',
  '1000',
  '2000',
  '4000',
  '8000',
] as const;

export function isSpectrum(value: PropertyValue): value is Spectrum {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((band) => typeof band === 'number')
  );
}

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
  // A key this application used to spell differently still opens the files
  // that used it, and says so rather than being quietly accepted for ever.
  const older = new Map<string, PropertyDescriptor>();
  for (const property of schema.properties)
    for (const alias of property.aliases ?? []) older.set(alias, property);

  for (const key of Object.keys(values)) {
    const property = declared.get(key) ?? older.get(key);
    if (property === undefined) {
      issues.push({
        path: key,
        message: `${schema.family} declares no property ${key}`,
      });
      continue;
    }
    if (!declared.has(key))
      issues.push({
        path: key,
        message: `${key} is an older spelling of ${property.key}`,
      });
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
      if (typeof value !== 'string' || value.trim() === '')
        return at(`${property.key} must be a non-empty string`);
      // A family may accept fewer values than the type allows without the
      // property itself becoming an enumeration everywhere else.
      return property.options === undefined || property.options.includes(value)
        ? []
        : at(`${property.key} must be one of ${property.options.join(', ')}`);
    case 'spectrum': {
      if (!isSpectrum(value))
        return at(`${property.key} must give a number per octave band`);
      const bands = Object.keys(value);
      if (bands.length === 0) return at(`${property.key} gives no band at all`);
      const issues: PropertyIssue[] = [];
      for (const band of bands) {
        if (!(OCTAVE_BANDS_HZ as readonly string[]).includes(band))
          issues.push({
            path: `${property.key}/${band}`,
            message: `${band} Hz is not one of the octave bands ${OCTAVE_BANDS_HZ.join(', ')}`,
          });
        else
          issues.push(
            ...outOfRange(property, value[band]!).map(({ message }) => ({
              path: `${property.key}/${band}`,
              message,
            })),
          );
      }
      return issues;
    }
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
 * A property definition as a data file states it, before anything is checked.
 *
 * The strict type says `PropertyType`; a JSON file says `string`, and the
 * difference between the two is what validation earns.
 */
export interface PropertyDefinitionCandidate extends Omit<
  PropertyDefinition,
  'type'
> {
  readonly type: string;
}

/**
 * Everything wrong with the definitions themselves.
 *
 * These are what every schema, every catalogue entry and every form is
 * measured against, which makes them the one thing nothing else can reveal. A
 * key defined twice means the second definition silently wins; a number with
 * no unit is a number nobody can read back — three what?
 */
export function validatePropertyDefinitions(
  definitions: readonly PropertyDefinitionCandidate[],
): readonly PropertyIssue[] {
  const issues: PropertyIssue[] = [];
  const at = (path: string, message: string) => issues.push({ path, message });
  const seen = new Set<string>();
  for (const [index, definition] of definitions.entries()) {
    const where = definition.id.trim() === '' ? `${index}` : definition.id;
    if (definition.id.trim() === '') at(where, 'must have an identifier');
    else if (seen.has(definition.id)) at(where, 'is defined more than once');
    seen.add(definition.id);
    for (const alias of definition.aliases ?? []) {
      if (seen.has(alias)) at(where, `the older spelling ${alias} is taken`);
      seen.add(alias);
    }
    if (definition.label.trim() === '') at(where, 'must have a label');
    if (!(PROPERTY_TYPES as readonly string[]).includes(definition.type))
      at(where, `unknown type ${definition.type}`);
    // A spectrum is a number per band, so it carries a unit like any other
    // measured quantity: an absorption coefficient is a ratio, a sound
    // reduction is in decibels.
    const numeric =
      definition.type === 'number' ||
      definition.type === 'integer' ||
      definition.type === 'spectrum';
    if (numeric && (definition.unit ?? '').trim() === '')
      at(where, 'is a number and states no unit');
    if (definition.unit !== undefined && !isWrittenUnit(definition.unit))
      at(
        where,
        `${definition.unit} is not one of the units this application writes`,
      );
    // The quantity and the unit have to agree: a power measured in millimetres
    // is a property nobody can convert and nobody can check.
    const measured =
      definition.unit === undefined ? undefined : quantityOf(definition.unit);
    if (
      measured !== undefined &&
      definition.quantity !== undefined &&
      definition.quantity !== measured
    )
      at(
        where,
        `says it measures ${definition.quantity} and is written in ${definition.unit}, which measures ${measured}`,
      );
    if (definition.displayUnit !== undefined) {
      if (!isWrittenUnit(definition.displayUnit))
        at(
          where,
          `${definition.displayUnit} is not a unit this application writes`,
        );
      else if (measured !== quantityOf(definition.displayUnit))
        at(where, 'is read in a unit that measures something else');
    }
    if (!numeric && definition.unit !== undefined)
      at(where, 'states a unit and is not a number');
  }
  return issues;
}

/**
 * Everything wrong with one family's constraints.
 *
 * A schema no longer says what a property *is* — that is the definition's job
 * — so what is left to check is that it names properties that exist and asks
 * of them things they can satisfy.
 */
export function validatePropertySchema(
  schema: PropertySchemaFile,
  defined: (key: string) => PropertyDefinition | undefined,
): readonly PropertyIssue[] {
  const issues: PropertyIssue[] = [];
  const at = (path: string, message: string) => issues.push({ path, message });
  if (schema.family.trim() === '') at('family', 'must not be empty');
  const seen = new Set<string>();
  for (const [index, constraint] of schema.properties.entries()) {
    const where =
      constraint.key.trim() === '' ? `properties/${index}` : constraint.key;
    if (constraint.key.trim() === '') at(where, 'must have a key');
    else if (seen.has(constraint.key)) at(where, 'is declared more than once');
    seen.add(constraint.key);
    const definition = defined(constraint.key);
    if (definition === undefined) {
      at(where, 'names no property this application defines');
      continue;
    }
    if (!(PROPERTY_SOURCES as readonly string[]).includes(constraint.source))
      at(where, `unknown source ${constraint.source}`);
    if (constraint.options !== undefined) {
      if (constraint.options.length === 0)
        at(where, 'accepts a list of values and the list is empty');
      // A family may accept fewer values than the type allows; it may not
      // pretend a number is a list.
      if (definition.type !== 'enum' && definition.type !== 'string')
        at(where, `${definition.type} values cannot be listed`);
    }
    if (definition.type === 'enum' && (constraint.options ?? []).length === 0)
      at(where, 'is a list of values and names none');
    for (const [bound, value] of [
      ['minimum', constraint.minimum],
      ['maximum', constraint.maximum],
    ] as const)
      if (value !== undefined && !Number.isFinite(value))
        at(`${where}/${bound}`, 'must be a finite number');
    if (
      constraint.minimum !== undefined &&
      constraint.maximum !== undefined &&
      constraint.minimum > constraint.maximum
    )
      at(where, 'has a minimum above its maximum, which nothing can satisfy');
  }
  return issues;
}
