import architecture from '../data/families/architecture.json' with { type: 'json' };
import dataSafetySite from '../data/families/data-safety-site.json' with { type: 'json' };
import electrical from '../data/families/electrical.json' with { type: 'json' };
import energyFlue from '../data/families/energy-flue.json' with { type: 'json' };
import heatingVentilation from '../data/families/heating-ventilation.json' with { type: 'json' };
import materials from '../data/families/materials.json' with { type: 'json' };
import networkProducts from '../data/families/network-products.json' with { type: 'json' };
import openings from '../data/families/openings.json' with { type: 'json' };
import plumbing from '../data/families/plumbing.json' with { type: 'json' };
import wastewaterRainwater from '../data/families/wastewater-rainwater.json' with { type: 'json' };
import propertySchemas from '../data/property-schemas/schemas.json' with { type: 'json' };
import type { FamilyDefinition, FamilyIssue } from './families.js';
import { validateFamily } from './families.js';
import type { PropertySchema } from './property-schemas.js';
import type { DataDomain, DataRegistry } from './registries.js';

/**
 * The master nomenclature, as data.
 *
 * Five hundred families do not belong in TypeScript. They are not code: they
 * are what the code is about, they change without the code changing, and
 * several people have to be able to work on different parts of them at once
 * without meeting in the same file. What TypeScript keeps is the shape they
 * have to have and the rules they have to obey — which is what a compiler is
 * for and what a list of five hundred things is not.
 */
const SOURCES = [
  architecture,
  openings,
  materials,
  plumbing,
  wastewaterRainwater,
  electrical,
  heatingVentilation,
  energyFlue,
  dataSafetySite,
  networkProducts,
] as readonly { readonly families: readonly FamilyDefinition[] }[];

export const FAMILY_REGISTRY: readonly FamilyDefinition[] = SOURCES.flatMap(
  ({ families }) => families,
);

export const PROPERTY_SCHEMA_REGISTRY: readonly PropertySchema[] = (
  propertySchemas as { readonly schemas: readonly PropertySchema[] }
).schemas;

const BY_ID = new Map(FAMILY_REGISTRY.map((family) => [family.id, family]));
const SCHEMA_BY_FAMILY = new Map(
  PROPERTY_SCHEMA_REGISTRY.map((schema) => [schema.family, schema]),
);

export function family(id: string): FamilyDefinition | undefined {
  return BY_ID.get(id);
}

export function propertySchema(id: string): PropertySchema | undefined {
  return SCHEMA_BY_FAMILY.get(id);
}

/** The property schema a family's entries are checked against, if it names one. */
export function schemaOfFamily(id: string): PropertySchema | undefined {
  const found = BY_ID.get(id);
  return found?.propertySchema === undefined
    ? undefined
    : SCHEMA_BY_FAMILY.get(found.propertySchema);
}

export function familiesOfDomain(
  domain: DataDomain,
): readonly FamilyDefinition[] {
  return FAMILY_REGISTRY.filter((entry) => entry.domain === domain);
}

export function familiesOfRegistry(
  registry: DataRegistry,
): readonly FamilyDefinition[] {
  return FAMILY_REGISTRY.filter((entry) => entry.registry === registry);
}

/** The families of one wave, which is one batch of work. */
export function familiesOfWave(priority: number): readonly FamilyDefinition[] {
  return FAMILY_REGISTRY.filter((entry) => entry.priority === priority);
}

export interface RegistryIssue extends FamilyIssue {
  readonly familyId: string;
}

/**
 * Everything wrong with the nomenclature, in one pass.
 *
 * Five hundred families cannot be proof-read by eye, and a family naming a
 * port nobody defined or a symbol that does not exist will fail silently at
 * the moment it is used — which is months later, in front of a user.
 */
export function validateRegistry(known: {
  readonly symbols: ReadonlySet<string>;
  readonly calculators: ReadonlySet<string>;
}): readonly RegistryIssue[] {
  const issues: RegistryIssue[] = [];
  const seen = new Set<string>();
  const schemas = new Set(SCHEMA_BY_FAMILY.keys());
  for (const entry of FAMILY_REGISTRY) {
    if (seen.has(entry.id))
      issues.push({
        familyId: entry.id,
        path: 'id',
        message: 'is declared more than once',
      });
    seen.add(entry.id);
    for (const issue of validateFamily(entry, {
      symbols: known.symbols,
      propertySchemas: schemas,
      calculators: known.calculators,
    }))
      issues.push({ familyId: entry.id, ...issue });
  }
  // A schema nobody uses is a schema nobody maintains, and it will be wrong by
  // the time a family finally names it.
  const used = new Set(
    FAMILY_REGISTRY.flatMap((entry) =>
      entry.propertySchema === undefined ? [] : [entry.propertySchema],
    ),
  );
  for (const schema of SCHEMA_BY_FAMILY.keys())
    if (!used.has(schema))
      issues.push({
        familyId: schema,
        path: 'propertySchema',
        message: 'is declared and no family uses it',
      });
  return issues;
}
