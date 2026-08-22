import type { DataDomain } from '@house-technical-designer/technical-types';

export type ProductPropertyValue = string | number | boolean;

/**
 * A length of something a network is made of: pipe, cable, duct, flue.
 *
 * These are not equipment. A PER 16×2 is a product with a diameter, a
 * roughness and a pressure class, and there are three hundred of them; making
 * each one an « equipment definition » with ports and clearances would be
 * describing a tube as though it were a heat pump. And none of it belongs in
 * `NetworkEdge`: an edge is a run drawn in a building, the product is what the
 * run is made of, and one project uses the same product on forty edges.
 */
export interface NetworkProduct {
  readonly id: string;
  /** PIPE, CABLE, DUCT, CONDUIT, FLUE — the family it is an entry of. */
  readonly family: string;
  readonly domain: DataDomain;
  readonly label: string;
  readonly version?: string;
  readonly properties: Readonly<Record<string, ProductPropertyValue>>;
  readonly provenance: {
    readonly type: string;
    readonly reference: string;
    readonly url?: string;
    readonly validAt?: string;
  };
}

interface ProductFile {
  readonly products: readonly NetworkProduct[];
}

/**
 * Every product file under `data`, found rather than listed.
 *
 * The tree is the list: adding a file is `git add`, and nothing else. Sorted by
 * path so that two machines, and two runs, read the products in the same order
 * — a fingerprint over an arbitrary order is one that moves when the
 * filesystem does.
 */
const DISCOVERED = import.meta.glob('../data/**/*.json', {
  eager: true,
  import: 'default',
}) as Readonly<Record<string, ProductFile>>;

/** The files this catalogue is made of, in a stable order. */
export function networkProductCatalogSources(): readonly string[] {
  return Object.keys(DISCOVERED)
    .map((path) => path.replace('../', 'packages/network-products/'))
    .sort();
}

export const NETWORK_PRODUCT_REGISTRY: readonly NetworkProduct[] = Object.keys(
  DISCOVERED,
)
  .sort()
  .flatMap((path) => DISCOVERED[path]!.products);

const BY_ID = new Map(
  NETWORK_PRODUCT_REGISTRY.map((product) => [product.id, product]),
);

export function networkProduct(id: string): NetworkProduct | undefined {
  return BY_ID.get(id);
}

export function networkProductsOfFamily(
  family: string,
): readonly NetworkProduct[] {
  return NETWORK_PRODUCT_REGISTRY.filter(
    (product) => product.family === family,
  );
}

/**
 * Enough of a product to say what a run is made of.
 *
 * The project's own copy and the catalogue's entry are the same thing from
 * here: a set of properties under an identifier.
 */
export interface NetworkProductLike {
  readonly id: string;
  readonly properties: Readonly<Record<string, unknown>>;
}

/**
 * What a run made of this product is, in the units the calculations read.
 *
 * The catalogue speaks the trade's units — a bore in millimetres, a roughness
 * in millimetres — and the hydraulics speak metres. Somebody had to convert,
 * and until now that somebody was whoever typed the segment's properties by
 * hand, forty times per project, from a datasheet. A figure entered by hand
 * forty times is a figure wrong at least once, and nothing said which one.
 *
 * Only what can be read from the product is produced. A product that states no
 * bore yields no diameter: the calculation then says the segment is not sized,
 * which is true, rather than sizing it on a number nobody supplied.
 */
export function productPhysicalProperties(
  product: NetworkProductLike,
): Readonly<Record<string, ProductPropertyValue>> {
  const number = (key: string): number | undefined => {
    const value = product.properties[key];
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : undefined;
  };
  const inner = number('innerDiameterMm');
  const roughness = number('roughnessMm');
  const width = number('widthMm');
  const height = number('heightMm');
  const section = number('sectionMm2');
  // A tube names what it is made of « material »; a cable names its conductor
  // « conductor ». Both answer the same question, and reading only the first
  // left every cable in the catalogue saying nothing about its copper.
  const material = product.properties.material ?? product.properties.conductor;
  return {
    ...(inner === undefined
      ? {}
      : { internalDiameterM: inner / 1000, diameterM: inner / 1000 }),
    ...(roughness === undefined ? {} : { roughnessM: roughness / 1000 }),
    ...(width === undefined ? {} : { widthM: width / 1000 }),
    ...(height === undefined ? {} : { heightM: height / 1000 }),
    ...(section === undefined ? {} : { conductorSectionMm2: section }),
    ...(typeof material === 'string'
      ? { material, conductorMaterial: material }
      : {}),
  };
}

/**
 * What a run is made of, the product first and the segment having the last
 * word.
 *
 * A segment's own properties are what this run measures or overrides — a
 * slope, a length, a bore somebody has good reason to state — and they win.
 * What they no longer have to repeat is the product itself.
 *
 * The product is looked for among the ones the project holds before the ones
 * the catalogue ships. A file has to open the same way in two years: reading
 * the installed catalogue would resize every network already drawn, the day
 * somebody corrects a tube.
 */
export function resolvedSegmentProperties(
  productId: string | undefined,
  own: Readonly<Record<string, unknown>> | undefined,
  held: readonly NetworkProductLike[] = [],
): Readonly<Record<string, unknown>> {
  const product =
    productId === undefined
      ? undefined
      : (held.find(({ id }) => id === productId) ?? networkProduct(productId));
  return {
    ...(product === undefined ? {} : productPhysicalProperties(product)),
    ...own,
  };
}
