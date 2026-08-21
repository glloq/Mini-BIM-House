import type { FamilyDefinition } from './families.js';
import { isPortType, portType } from './port-types.js';
import {
  validateProperties,
  type PropertySchema,
  type PropertyValue,
} from './property-schemas.js';
import { validateProvenance, type ProvenanceCandidate } from './provenance.js';

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
  readonly rendering?: {
    readonly symbols?: readonly { readonly symbolId: string }[];
  };
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
  if (entry.version !== undefined && entry.version.trim() === '')
    at('version', 'must not be empty');

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
  const declared = new Set<string>();
  for (const [index, port] of (entry.ports ?? []).entries()) {
    if (port.portTypeId === undefined) {
      at(`ports/${index}`, `${port.id} does not say what kind of port it is`);
      continue;
    }
    if (!isPortType(port.portTypeId)) {
      at(`ports/${index}`, `unknown port type ${port.portTypeId}`);
      continue;
    }
    declared.add(port.portTypeId);
  }
  for (const required of family.ports ?? [])
    if (!declared.has(required) && !servedBy(declared, required))
      at(
        'ports',
        `${family.id} is connected by ${required}, which this entry does not declare`,
      );

  for (const [index, symbol] of (entry.rendering?.symbols ?? []).entries())
    if (!known.symbols.has(symbol.symbolId))
      at(`rendering/symbols/${index}`, `unknown symbol ${symbol.symbolId}`);

  for (const issue of validateProvenance(entry.provenance))
    at(issue.path, issue.message);
  return issues;
}

/**
 * Whether a port the family asks for is served by one the entry declares.
 *
 * A family says a heat pump is connected by `HEATING_FLOW`; an entry may
 * declare the facing `HEATING_RETURN` for the same circuit. What matters is
 * that the service is there, not that the two strings match.
 */
function servedBy(declared: ReadonlySet<string>, required: string): boolean {
  const wanted = portType(required);
  if (wanted === undefined) return false;
  for (const id of declared) {
    const found = portType(id);
    if (found?.service === wanted.service) return true;
  }
  return false;
}
