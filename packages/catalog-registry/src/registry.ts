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
import networkProductCatalog from '../data/network-products/generic.json' with { type: 'json' };
import propertySchemas from '../data/property-schemas/schemas.json' with { type: 'json' };
import type {
  CatalogEntryCandidate,
  CatalogIssue,
} from './catalog-validation.js';
import { validateCatalogEntry } from './catalog-validation.js';
import type { FamilyDefinition, FamilyIssue } from './families.js';
import { validateFamily } from './families.js';
import type { NetworkProduct } from './network-products.js';
import { invalidBore } from './network-products.js';
import { validateProperties, type PropertySchema } from './property-schemas.js';
import { validateProvenance } from './provenance.js';
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

/**
 * The lengths a network is made of: pipes, cables, ducts, flues.
 *
 * Sixty-six of them to start with, and there will be three hundred. None of it
 * belongs in `NetworkEdge`: an edge is a run drawn in a building, the product
 * is what the run is made of, and one project uses the same product on forty
 * edges.
 */
export const NETWORK_PRODUCT_REGISTRY: readonly NetworkProduct[] = (
  networkProductCatalog as { readonly products: readonly NetworkProduct[] }
).products;

export const PROPERTY_SCHEMA_REGISTRY: readonly PropertySchema[] = (
  propertySchemas as { readonly schemas: readonly PropertySchema[] }
).schemas;

const BY_ID = new Map(FAMILY_REGISTRY.map((family) => [family.id, family]));
const PRODUCT_BY_ID = new Map(
  NETWORK_PRODUCT_REGISTRY.map((product) => [product.id, product]),
);
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

export function networkProduct(id: string): NetworkProduct | undefined {
  return PRODUCT_BY_ID.get(id);
}

/** Every product of one family, which is what a run may be made of. */
export function productsOfFamily(familyId: string): readonly NetworkProduct[] {
  return NETWORK_PRODUCT_REGISTRY.filter(
    (product) => product.family === familyId,
  );
}

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
      }),
    );
  }
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
