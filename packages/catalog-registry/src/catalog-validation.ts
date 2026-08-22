import {
  CLEARANCE_LABELS,
  isClearanceZone,
  isPortType,
  portRequirement,
  unmetRequirements,
  type ClearanceZoneDefinition,
} from '@house-technical-designer/technical-types';
import type { FamilyDefinition } from './families.js';
import {
  validateProperties,
  type PropertyDefinition,
  type PropertySchema,
  type PropertyValue,
} from './property-schemas.js';
import { validatePerformanceVocabulary } from './performance-vocabulary.js';
import { validateProvenance, type ProvenanceCandidate } from './provenance.js';
import { hasCapability } from './capabilities.js';

/**
 * A catalogue entry as anything that produces one states it.
 *
 * The generic catalogue, an imported manufacturer file and a definition typed
 * by a user all have to pass the same gate, so the gate takes the shape they
 * share rather than any one of their types.
 */
export interface CatalogEntryCandidate {
  readonly id: string;
  readonly familyId: string;
  readonly name?: string;
  readonly version?: string;
  readonly properties: Readonly<Record<string, PropertyValue>>;
  readonly ports?: readonly {
    readonly id: string;
    readonly portTypeId?: string;
  }[];
  readonly provenance?: ProvenanceCandidate;
  readonly clearances?: readonly (Omit<ClearanceZoneDefinition, 'zone'> & {
    readonly zone: string;
  })[];
  readonly rendering?: {
    readonly symbols?: readonly { readonly symbolId: string }[];
  };
  readonly performanceCurves?: readonly {
    readonly id: string;
    readonly inputAxes: readonly {
      readonly id: string;
      readonly unit: string;
    }[];
    readonly output: string;
    readonly outputUnit: string;
  }[];
  /**
   * The bucket the entry claims for itself.
   *
   * It must not claim one. Kept in the shape only so that the gate can say so:
   * a field silently ignored is a field somebody will go on filling in.
   */
  readonly category?: string;
  readonly kind?: string;
}

/**
 * A version, as versions are compared.
 *
 * Free text would let `1.0`, `v1.0.0` and `1.0.0-final` all name the same
 * entry and none of them sort against the others; a project pinning one could
 * never be told whether the catalogue had moved forward or back.
 */
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

/**
 * What this entry says, reduced to one string.
 *
 * A version is a promise: `generic-battery@1.0.0` must mean the same figures
 * today as it did when a project pinned it. Nothing enforced that promise, so
 * a fiche could be corrected in place and every project holding the old pin
 * would silently be designing with the new numbers while claiming the old
 * ones. Comparing this against what was recorded is how the promise is kept.
 *
 * Order does not matter and formatting does not either: what is compared is
 * the content, sorted, not the file.
 */
export function catalogFingerprint(entry: CatalogEntryCandidate): string {
  const { id: _id, version: _version, ...rest } = entry;
  return contentFingerprint(rest);
}

/**
 * What any value says, reduced to one short string.
 *
 * Order does not matter and formatting does not either: what is compared is
 * the content, sorted, not the file. Used for one entry and for a whole
 * catalogue alike — a manifest has to notice that a file changed, which is the
 * same question asked of more of it.
 */
export function contentFingerprint(value: unknown): string {
  const canonical = (held: unknown): unknown => {
    if (Array.isArray(held)) return held.map(canonical);
    if (held !== null && typeof held === 'object')
      return Object.fromEntries(
        Object.entries(held as Record<string, unknown>)
          .filter(([, inner]) => inner !== undefined)
          .sort(([first], [second]) => first.localeCompare(second))
          .map(([key, inner]) => [key, canonical(inner)]),
      );
    return held;
  };
  const text = JSON.stringify(canonical(value));
  // A short, stable digest: the point is to notice a change, not to resist an
  // attacker, and a hash nobody can read is a hash nobody checks.
  let low = 0x811c9dc5;
  let high = 0x01000193;
  for (let index = 0; index < text.length; index += 1) {
    low = Math.imul(low ^ text.charCodeAt(index), 0x01000193) >>> 0;
    high =
      Math.imul(high + text.charCodeAt(index) * (index + 1), 0x85ebca6b) >>> 0;
  }
  return `${low.toString(16).padStart(8, '0')}${high.toString(16).padStart(8, '0')}`;
}

export interface CatalogIssue {
  readonly entryId: string;
  readonly path: string;
  readonly message: string;
}

export interface CatalogKnowledge {
  readonly family: (id: string) => FamilyDefinition | undefined;
  readonly schema: (id: string) => PropertySchema | undefined;
  readonly symbols: ReadonlySet<string>;
  /**
   * What a property key means, so that a performance axis can be checked to
   * name one — and to state its unit.
   *
   * Not optional. A gate that can be called without half of what it checks is
   * a gate that will be, and the half nobody passed is the half nothing
   * verifies.
   */
  readonly property: (key: string) => PropertyDefinition | undefined;
}

/**
 * Everything wrong with one catalogue entry, measured against its own family.
 *
 * This is the gate the audit found missing, and the reason it mattered: the
 * battery pack declared `BATTERY_DEVICE` as its schema and carried
 * `maxChargePowerKW` where the schema says `maximumChargePowerW`. Both files
 * were valid on their own, the family said `GENERIC_DATA: READY`, and the
 * continuous integration was green — because nothing compared the two.
 *
 * Filling a catalogue with a thousand entries without this is filling it with
 * a thousand entries nobody has compared to anything.
 */
export function validateCatalogEntry(
  entry: CatalogEntryCandidate,
  known: CatalogKnowledge,
): readonly CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const at = (path: string, message: string): void => {
    issues.push({ entryId: entry.id, path, message });
  };
  if (entry.id.trim() === '') at('id', 'must not be empty');
  // Every entry states its version, and states it the way versions are
  // compared. Without one, a project can pin nothing and a correction reaches
  // every house already designed with the entry.
  if (entry.version === undefined) at('version', 'must state a version');
  else if (!SEMVER.test(entry.version))
    at('version', `${entry.version} is not a version of the form 1.0.0`);

  const family = known.family(entry.familyId);
  if (family === undefined) {
    at('familyId', `unknown family ${entry.familyId}`);
    return issues;
  }

  // The properties: named, typed, in range, and belonging to the definition
  // rather than to the instance or to what the model derives.
  const schema =
    family.propertySchema === undefined
      ? undefined
      : known.schema(family.propertySchema);
  if (family.propertySchema !== undefined && schema === undefined)
    at(
      'familyId',
      `${family.id} names an unknown schema ${family.propertySchema}`,
    );
  if (schema !== undefined)
    for (const issue of validateProperties(
      schema,
      entry.properties,
      'DEFINITION',
    ))
      at(`properties/${issue.path}`, issue.message);

  // The ports: each one a kind the registry knows, and between them at least
  // what the family says such a thing is connected by. A heat pump missing its
  // return is a heat pump nothing can route.
  const declared: string[] = [];
  for (const [index, port] of (entry.ports ?? []).entries()) {
    if (port.portTypeId === undefined) {
      at(`ports/${index}`, `${port.id} does not say what kind of port it is`);
      continue;
    }
    if (!isPortType(port.portTypeId)) {
      at(`ports/${index}`, `unknown port type ${port.portTypeId}`);
      continue;
    }
    declared.push(port.portTypeId);
  }
  // Each declared port answers for one requirement and no more. Matching by
  // service let `HEATING_RETURN` satisfy a family asking for both a flow and a
  // return, since the two carry the same water — so a heat pump with one water
  // connection passed for one with two.
  for (const issue of unmetRequirements(
    (family.ports ?? []).map(portRequirement),
    declared,
  ))
    at('ports', `${family.id} ${issue.message}`);

  // Three taxonomies for one thing is how they drift. The family says what
  // this is; an entry repeating it in its own words is the second version of a
  // sentence that already existed, and `generic-pv-module` proved it — `kind:
  // PHOTOVOLTAIC` beside `category: PV_MODULE`, both files valid, at nineteen
  // entries.
  if (entry.category !== undefined)
    at('category', 'the category is the family’s and is not restated here');
  if (entry.kind !== undefined)
    at('kind', 'the kind is the family’s category and is not restated here');

  // What an entry is allowed to carry is what its family can do. An entry with
  // a performance map in a family nothing tabulates is a map no calculation
  // will ever open, and it will sit there looking complete.
  if (
    (entry.performanceCurves ?? []).length > 0 &&
    !hasCapability(family, 'PERFORMANCE_MAPPED')
  )
    at(
      'performanceCurves',
      `${family.id} does not declare a tabulated performance`,
    );
  // An axis called `outdoorTemperatureC` in one fiche and `tempExtC` in the
  // next are two different axes to everything that reads them, and no amount
  // of well-formed tabulation makes a calculation find the second.
  for (const [index, curve] of (entry.performanceCurves ?? []).entries())
    for (const issue of validatePerformanceVocabulary(
      curve,
      `performanceCurves/${index}`,
      known.property,
    ))
      at(issue.path, issue.message);

  // The room around it: the family says which zones such a thing has, the
  // entry says how far each one reaches. An entry claiming a zone its family
  // does not have is either the wrong family or a zone nobody will draw.
  const zones = new Set(family.clearances ?? []);
  const sides = [
    'frontMm',
    'backMm',
    'leftMm',
    'rightMm',
    'aboveMm',
    'belowMm',
  ] as const;
  for (const [index, clearance] of (entry.clearances ?? []).entries()) {
    if (!isClearanceZone(clearance.zone)) {
      at(`clearances/${index}`, `unknown clearance zone ${clearance.zone}`);
      continue;
    }
    // What an object occupies is its own dimensions, which it already states.
    if (clearance.zone === 'PHYSICAL')
      at(
        `clearances/${index}`,
        'the volume a thing occupies is its own dimensions and is not declared',
      );
    else if (!zones.has(clearance.zone))
      at(
        `clearances/${index}`,
        `${family.id} declares no ${CLEARANCE_LABELS[clearance.zone]} zone`,
      );
    for (const side of sides) {
      const value = clearance[side];
      if (value !== undefined && (!Number.isFinite(value) || value < 0))
        at(
          `clearances/${index}/${side}`,
          'must be a distance in millimetres, at least zero',
        );
    }
    if (sides.every((side) => clearance[side] === undefined))
      at(`clearances/${index}`, 'says no distance in any direction');
  }

  for (const [index, symbol] of (entry.rendering?.symbols ?? []).entries())
    if (!known.symbols.has(symbol.symbolId))
      at(`rendering/symbols/${index}`, `unknown symbol ${symbol.symbolId}`);

  for (const issue of validateProvenance(entry.provenance))
    at(issue.path, issue.message);
  return issues;
}
