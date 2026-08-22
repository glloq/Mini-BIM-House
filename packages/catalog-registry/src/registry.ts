import {
  portRequirement,
  unknownPortKinds,
  type DataDomain,
  type DataRegistry,
} from '@house-technical-designer/technical-types';
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
import propertyDefinitions from '../data/property-schemas/properties.json' with { type: 'json' };
import propertySchemas from '../data/property-schemas/schemas.json' with { type: 'json' };
import type {
  CatalogEntryCandidate,
  CatalogIssue,
} from './catalog-validation.js';
import {
  catalogFingerprint,
  validateCatalogEntry,
} from './catalog-validation.js';
import fingerprints from '../data/fingerprints.json' with { type: 'json' };
import type { FamilyDefinition, FamilyIssue } from './families.js';
import { validateFamily } from './families.js';
import {
  capabilitiesOf,
  hasCapability,
  type CatalogCapability,
} from './capabilities.js';
import {
  performanceVocabulary,
  type PerformanceMapCandidate,
} from './performance-vocabulary.js';
import {
  isOfferable,
  DEFAULT_LIFECYCLE,
  type CatalogRef,
} from './catalog-identity.js';
import {
  genericEquipmentCatalog,
  isEquipmentCategory,
  type EquipmentCategory,
  type EquipmentDefinition,
} from '@house-technical-designer/equipment-catalog';
import { rawGenericMaterialEntries } from '@house-technical-designer/materials';
import {
  genericAssemblyCatalog,
  rawGenericAssemblyEntries,
  type Assembly,
} from '@house-technical-designer/assemblies';
import {
  validateAssemblyEntry,
  validateMaterialEntry,
  type MaterialIssue,
} from './material-catalog.js';
import { invalidBore } from './network-products.js';
import {
  NETWORK_PRODUCT_REGISTRY,
  networkProductsOfFamily,
} from '@house-technical-designer/network-products';
import {
  describedProperty,
  validateProperties,
  validatePropertyDefinitions,
  validatePropertySchema,
  type PropertyDefinition,
  type PropertyIssue,
  type PropertySchema,
  type PropertySchemaFile,
} from './property-schemas.js';
import { validateProvenance } from './provenance.js';
import type { FamilyReview } from './report.js';
import { isHostType } from '@house-technical-designer/core-domain';
import {
  type FamilyStatus,
  type MeasuredAxis,
  type StatusValue,
} from './status.js';

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

/**
 * The lengths a network is made of: pipes, cables, ducts, flues.
 *
 * Sixty-six of them to start with, and there will be three hundred. None of it
 * belongs in `NetworkEdge`: an edge is a run drawn in a building, the product
 * is what the run is made of, and one project uses the same product on forty
 * edges.
 */

/**
 * Every property this application knows, defined once.
 *
 * Two hundred and forty-six keys were spread over forty-four schemas, and
 * eleven of them had already drifted: `cost` meant four different quantities
 * and `pressureDrop` was stored in one schema and derived in another. A key
 * now means one thing, and a family says which keys it uses.
 */
export const PROPERTY_DEFINITION_REGISTRY: readonly PropertyDefinition[] = (
  propertyDefinitions as { readonly properties: readonly PropertyDefinition[] }
).properties;

const DEFINITION_BY_ID = new Map<string, PropertyDefinition>();
for (const definition of PROPERTY_DEFINITION_REGISTRY) {
  DEFINITION_BY_ID.set(definition.id, definition);
  // An older spelling still opens the files that used it.
  for (const alias of definition.aliases ?? [])
    DEFINITION_BY_ID.set(alias, definition);
}

/** What a key means, whichever spelling of it a file uses. */
export function propertyDefinition(
  key: string,
): PropertyDefinition | undefined {
  return DEFINITION_BY_ID.get(key);
}

const SCHEMA_FILES = (
  propertySchemas as { readonly schemas: readonly PropertySchemaFile[] }
).schemas;

/**
 * The schemas as everything downstream reads them.
 *
 * Each family's constraints resolved against the property definitions. A key
 * nothing defines is left described by itself rather than dropped: the gate
 * reports it, and dropping it would hide the very thing that is wrong.
 */
export const PROPERTY_SCHEMA_REGISTRY: readonly PropertySchema[] =
  SCHEMA_FILES.map((schema) => ({
    family: schema.family,
    properties: schema.properties.map((constraint) => {
      const definition = propertyDefinition(constraint.key);
      return definition === undefined
        ? {
            key: constraint.key,
            label: constraint.key,
            type: 'string' as const,
            source: constraint.source,
          }
        : describedProperty(definition, constraint);
    }),
  }));

/**
 * What each catalogue entry said when its version was fixed.
 *
 * Data rather than code: it is regenerated by a script and read by a gate, and
 * nobody is meant to reason about it.
 */
export const CATALOG_FINGERPRINTS: Readonly<Record<string, string>> = (
  fingerprints as { readonly entries: Readonly<Record<string, string>> }
).entries;

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

/**
 * The coarse grouping one family's entries fall into.
 *
 * The single statement the catalogue projects `kind` and `category` from. An
 * entry no longer says either, so this is where a screen sorting nineteen — or
 * ten thousand — entries gets its buckets.
 */
export function categoryOfFamily(familyId: string): string | undefined {
  return BY_ID.get(familyId)?.category;
}

/** The same, narrowed to the equipment list, for what the catalogue types. */
export function equipmentCategoryOfFamily(
  familyId: string,
): EquipmentCategory | undefined {
  const found = categoryOfFamily(familyId);
  return found === undefined || !isEquipmentCategory(found) ? undefined : found;
}

/** Everything a thing of this family can have done to it. */
export function familyCapabilities(
  familyId: string,
): readonly CatalogCapability[] {
  const found = BY_ID.get(familyId);
  return found === undefined ? [] : capabilitiesOf(found);
}

export function familyHasCapability(
  familyId: string,
  capability: CatalogCapability,
): boolean {
  const found = BY_ID.get(familyId);
  return found !== undefined && hasCapability(found, capability);
}

/**
 * Every family something may be done to, whatever it is.
 *
 * The replacement for `registry === 'EQUIPMENT' || registry === 'OPENING'` and
 * its dozen cousins. A new family gets its behaviour by declaring what it can
 * do; nothing here has to learn its name.
 */
export function familiesWithCapability(
  capability: CatalogCapability,
): readonly FamilyDefinition[] {
  return FAMILY_REGISTRY.filter((entry) => hasCapability(entry, capability));
}

/** Whether this family may still be offered to somebody starting a design. */
export function familyIsOfferable(familyId: string): boolean {
  const found = BY_ID.get(familyId);
  return (
    found !== undefined && isOfferable(found.lifecycle ?? DEFAULT_LIFECYCLE)
  );
}

/** What one catalogue entry is, said the one way every registry says it. */
export function equipmentRef(entry: {
  readonly id: string;
  readonly version?: string;
}): CatalogRef {
  return { registry: 'EQUIPMENT', id: entry.id, version: entry.version ?? '' };
}

/**
 * The generic catalogue with its families' projections stamped on.
 *
 * What the interface reads. `genericEquipmentCatalog()` gives the entries as
 * their files state them, and their files no longer state a category — the
 * family does. Anything grouping, filtering or sorting entries has to come
 * through here, or it will group by a field that is empty in every entry.
 */
export function genericCatalog(): readonly EquipmentDefinition[] {
  return genericEquipmentCatalog().map((entry) => {
    const category = equipmentCategoryOfFamily(entry.familyId);
    return category === undefined ? entry : { ...entry, category };
  });
}

/** The generic build-ups, grouped as their families say. */
export function genericAssemblies(): readonly Assembly[] {
  return genericAssemblyCatalog();
}

/**
 * Everything wrong with the material catalogue, in one pass.
 *
 * It was the last of the seven registries no gate had ever read.
 */
export function validateMaterialCatalog(): readonly MaterialIssue[] {
  const issues: MaterialIssue[] = [];
  const seen = new Set<string>();
  for (const entry of rawGenericMaterialEntries()) {
    if (seen.has(entry.id))
      issues.push({
        entryId: entry.id,
        path: 'id',
        message: 'is declared more than once',
      });
    seen.add(entry.id);
    issues.push(
      ...validateMaterialEntry(entry, { family, schema: propertySchema }),
    );
  }
  return issues;
}

/** Everything wrong with the build-ups, including what they are made of. */
export function validateAssemblyCatalog(): readonly MaterialIssue[] {
  const materials = new Set(rawGenericMaterialEntries().map(({ id }) => id));
  const issues: MaterialIssue[] = [];
  const seen = new Set<string>();
  for (const entry of rawGenericAssemblyEntries()) {
    if (seen.has(entry.id))
      issues.push({
        entryId: entry.id,
        path: 'id',
        message: 'is declared more than once',
      });
    seen.add(entry.id);
    issues.push(
      ...validateAssemblyEntry(entry, {
        family,
        schema: propertySchema,
        materials,
      }),
    );
  }
  return issues;
}

/** The property schema a family's entries are checked against, if it names one. */
export function schemaOfFamily(id: string): PropertySchema | undefined {
  const found = BY_ID.get(id);
  return found?.propertySchema === undefined
    ? undefined
    : SCHEMA_BY_FAMILY.get(found.propertySchema);
}

/** Every product of one family, which is what a run may be made of. */
export const productsOfFamily = networkProductsOfFamily;

export interface ProductIssue {
  readonly productId: string;
  readonly path: string;
  readonly message: string;
}

/**
 * Everything wrong with the network-product catalogue, in one pass.
 *
 * Three hundred tubes will have a typo in them, and a network sized on a tube
 * whose bore is wrong by four millimetres is wrong quietly.
 */
export function validateNetworkProducts(): readonly ProductIssue[] {
  const issues: ProductIssue[] = [];
  const seen = new Set<string>();
  for (const product of NETWORK_PRODUCT_REGISTRY) {
    const at = (path: string, message: string) =>
      issues.push({ productId: product.id, path, message });
    if (seen.has(product.id)) at('id', 'is declared more than once');
    seen.add(product.id);
    const owner = BY_ID.get(product.family);
    if (owner === undefined) {
      at('family', `unknown family ${product.family}`);
      continue;
    }
    // A run records which version of a product it was drawn with, so every
    // product has to state one, and state it the way versions are compared.
    if (product.version === undefined) at('version', 'must state a version');
    else if (!/^\d+\.\d+\.\d+$/u.test(product.version))
      at('version', `${product.version} is not a version of the form 1.0.0`);
    if (owner.registry !== 'NETWORK_PRODUCT')
      at('family', `${product.family} is not a network product family`);
    if (owner.domain !== product.domain)
      at('domain', `${product.family} belongs to ${owner.domain}`);
    const schema =
      owner.propertySchema === undefined
        ? undefined
        : SCHEMA_BY_FAMILY.get(owner.propertySchema);
    if (schema !== undefined)
      for (const issue of validateProperties(
        schema,
        product.properties,
        'DEFINITION',
      ))
        at(`properties/${issue.path}`, issue.message);
    for (const issue of validateProvenance(product.provenance))
      at(issue.path, issue.message);
    const bore = invalidBore(product.properties);
    if (bore !== undefined) at(`properties/${bore.path}`, bore.message);
  }
  return issues;
}

/**
 * Every catalogue entry checked against the family it claims to belong to.
 *
 * The generic catalogue is the first thing this runs on, and it is the reason
 * the gate exists: an entry can name a schema and carry different property
 * names, and both files stay valid on their own.
 */
export function validateCatalog(
  entries: readonly CatalogEntryCandidate[],
  symbols: ReadonlySet<string>,
  recorded: Readonly<Record<string, string>> = CATALOG_FINGERPRINTS,
): readonly CatalogIssue[] {
  const seen = new Set<string>();
  const issues: CatalogIssue[] = [];
  for (const entry of entries) {
    if (seen.has(entry.id))
      issues.push({
        entryId: entry.id,
        path: 'id',
        message: 'is declared more than once',
      });
    seen.add(entry.id);
    issues.push(
      ...validateCatalogEntry(entry, {
        family,
        schema: propertySchema,
        symbols,
        property: propertyDefinition,
      }),
    );
    // A version is a promise: `generic-battery@1.0.0` has to mean the same
    // figures today as when a project pinned it. Correcting a fiche in place
    // would leave every project holding the old pin designing with the new
    // numbers while claiming the old ones.
    // A family that somebody has actually modelled an entry of has to say what
    // bucket it belongs to: the entry no longer does, and a screen sorting ten
    // thousand references by a field nobody stated sorts them into one heap.
    const owner = BY_ID.get(entry.familyId);
    if (owner !== undefined && owner.category === undefined)
      issues.push({
        entryId: entry.id,
        path: 'familyId',
        message: `${owner.id} has catalogue entries and states no category`,
      });
    const stamp = recorded[`${entry.id}@${entry.version ?? ''}`];
    if (stamp !== undefined && stamp !== catalogFingerprint(entry))
      issues.push({
        entryId: entry.id,
        path: 'version',
        message: `has changed without its version changing: ${entry.id}@${entry.version} no longer says what it said. Raise the version, then run npm run catalog:fingerprints.`,
      });
  }
  return issues;
}

/** Everything the catalogue says right now, entry by entry. */
export function catalogFingerprints(
  entries: readonly CatalogEntryCandidate[],
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    [...entries]
      .sort((first, second) => first.id.localeCompare(second.id))
      .map((entry) => [
        `${entry.id}@${entry.version ?? ''}`,
        catalogFingerprint(entry),
      ]),
  );
}

/**
 * The five measured axes of one family, worked out from what is actually there.
 *
 * Nothing here reads what the family says about itself. `PORTS: READY` means
 * the family declares ports and every one of them is a kind the registry
 * knows; `VALIDATED` means a catalogue entry of that family declares them and
 * passes the gate. The difference between the two is the difference between
 * « written » and « proven », and it is the whole reason the axes exist.
 */
export function measuredStatus(
  familyId: string,
  known: {
    readonly symbols: ReadonlySet<string>;
    readonly entries: readonly CatalogEntryCandidate[];
  },
): Readonly<Record<MeasuredAxis, StatusValue>> {
  const owner = BY_ID.get(familyId);
  if (owner === undefined)
    return {
      PROPERTIES: 'NONE',
      PORTS: 'NONE',
      PLACEMENT: 'NONE',
      PLAN_SYMBOL: 'NONE',
      GENERIC_DATA: 'NONE',
      TESTS: 'NONE',
    };
  const mine = known.entries.filter((entry) => entry.familyId === familyId);
  const clean = mine.filter(
    (entry) =>
      validateCatalogEntry(entry, {
        family,
        schema: propertySchema,
        symbols: known.symbols,
        property: propertyDefinition,
      }).length === 0,
  );

  const schema =
    owner.propertySchema === undefined
      ? undefined
      : SCHEMA_BY_FAMILY.get(owner.propertySchema);
  const declaredPorts = (owner.ports ?? []).map(portRequirement);
  const knownPorts = declaredPorts.every(
    (requirement) => unknownPortKinds(requirement).length === 0,
  );
  const plan = owner.graphics?.planSymbol;

  // Declaring something is not knowing it: eight families declared ports made
  // of kinds the registry knows and were connected by things the object does
  // not have. So a declaration alone reaches `PARTIAL`, and it takes a
  // catalogue entry — somebody having modelled one of these — to go further.
  return {
    PROPERTIES:
      owner.propertySchema === undefined
        ? 'NONE'
        : schema === undefined || mine.length === 0
          ? 'PARTIAL'
          : clean.length > 0
            ? 'VALIDATED'
            : 'READY',
    PORTS:
      declaredPorts.length === 0
        ? 'NONE'
        : !knownPorts || mine.length === 0
          ? 'PARTIAL'
          : clean.length > 0
            ? 'VALIDATED'
            : 'READY',
    // Where it may go is measurable now that the supports are a closed list:
    // a family either names supports the editor can offer, or it does not.
    PLACEMENT:
      owner.placement === undefined
        ? 'NONE'
        : owner.placement.allowedHosts.every((host) => isHostType(host))
          ? 'READY'
          : 'PARTIAL',
    PLAN_SYMBOL:
      plan === undefined
        ? 'NONE'
        : known.symbols.has(plan)
          ? 'READY'
          : 'PARTIAL',
    GENERIC_DATA:
      mine.length === 0
        ? 'NONE'
        : clean.length === mine.length
          ? 'READY'
          : 'PARTIAL',
    // A family with an entry the gate passes is a family the suite exercises;
    // one nothing has an entry for is one nothing runs against.
    TESTS: clean.length > 0 ? 'VALIDATED' : 'NONE',
  };
}

/**
 * What a family says about itself, and what can be measured about it.
 *
 * The measured axes win, always: the point is that they cannot be typed.
 */
export function familyStatus(
  familyId: string,
  known: {
    readonly symbols: ReadonlySet<string>;
    readonly entries: readonly CatalogEntryCandidate[];
  },
): FamilyStatus {
  return {
    ...BY_ID.get(familyId)?.status,
    ...measuredStatus(familyId, known),
  };
}

/**
 * Every family together with where it has actually got to.
 *
 * The one way to look at the nomenclature as a whole: five axes measured here
 * and now, the rest as declared. Anything reporting on the registry starts
 * from this, so that no report can show only the half somebody typed.
 */
export function familyReviews(known: {
  readonly symbols: ReadonlySet<string>;
  readonly entries: readonly CatalogEntryCandidate[];
}): readonly FamilyReview[] {
  return FAMILY_REGISTRY.map((entry) => ({
    family: entry,
    status: familyStatus(entry.id, known),
  }));
}

export interface SchemaIssue extends PropertyIssue {
  readonly schemaId: string;
}

/**
 * Everything wrong with the schemas themselves.
 *
 * Everything else in this file is checked *against* a schema, which means a
 * schema that is wrong is the one thing nothing else can reveal. Two
 * declarations of one key, an enum accepting anything, a minimum above its
 * maximum: each of them makes a check pass that should have failed, and
 * quietly.
 */
export function validateSchemas(): readonly SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  // The definitions first: they are what the schemas are measured against, so
  // a definition that is wrong makes a check pass that should have failed.
  for (const issue of validatePropertyDefinitions(PROPERTY_DEFINITION_REGISTRY))
    issues.push({ schemaId: 'propriétés', ...issue });
  const seen = new Set<string>();
  for (const schema of SCHEMA_FILES) {
    if (seen.has(schema.family))
      issues.push({
        schemaId: schema.family,
        path: 'family',
        message: 'is declared more than once',
      });
    seen.add(schema.family);
    for (const issue of validatePropertySchema(schema, propertyDefinition))
      issues.push({ schemaId: schema.family, ...issue });
  }
  // A property nobody uses is a property nobody maintains, and it will be
  // wrong by the time a family finally names it. A schema is not the only way
  // to use one: a performance map names a property on each of its axes and on
  // its output, and those are the same vocabulary — an axis that named
  // something nothing had defined is exactly what the gate below refuses.
  const used = new Set([
    ...SCHEMA_FILES.flatMap(({ properties }) =>
      properties.map(({ key }) => key),
    ),
    ...performanceVocabulary(
      genericEquipmentCatalog().flatMap(
        ({ performanceCurves }) =>
          (performanceCurves ?? []) as readonly PerformanceMapCandidate[],
      ),
    ),
  ]);
  for (const definition of PROPERTY_DEFINITION_REGISTRY)
    if (!used.has(definition.id))
      issues.push({
        schemaId: 'propriétés',
        path: definition.id,
        message: 'is defined and no family uses it',
      });
  return issues;
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
      families: new Set(BY_ID.keys()),
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
