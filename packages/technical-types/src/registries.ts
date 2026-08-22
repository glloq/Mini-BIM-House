/**
 * The seven registries the data of this application is divided into.
 *
 * A PER pipe is not a heat pump, a window is not a piece of furniture, and an
 * insulant is not a placed object. Writing them all into one « catalogue of
 * things » is what makes a catalogue impossible to fill: every entry then has
 * to carry every field any of them might need, and nothing can be validated
 * because nothing says what this particular kind of entry owes.
 */
export const DATA_REGISTRIES = [
  'MATERIAL',
  'ASSEMBLY',
  'OPENING',
  'EQUIPMENT',
  'NETWORK_PRODUCT',
  'SYMBOL',
  'PROPERTY_SCHEMA',
] as const;
export type DataRegistry = (typeof DATA_REGISTRIES)[number];

export const DATA_REGISTRY_LABELS: Readonly<Record<DataRegistry, string>> = {
  MATERIAL: 'Matériaux',
  ASSEMBLY: 'Assemblages',
  OPENING: 'Ouvertures',
  EQUIPMENT: 'Composants et équipements',
  NETWORK_PRODUCT: 'Produits de réseau',
  SYMBOL: 'Symboles',
  PROPERTY_SCHEMA: 'Schémas de propriétés',
};

/** The trade a family belongs to, which is how a drawing is read. */
export const DATA_DOMAINS = [
  'ARCHITECTURE',
  'STRUCTURE',
  'SITE',
  'PLUMBING',
  'WASTEWATER',
  'RAINWATER',
  'HEATING',
  'VENTILATION',
  'ELECTRICAL',
  'LIGHTING',
  'SOLAR',
  'STORAGE',
  'FLUE',
  'DATA',
  'SAFETY',
  'FURNITURE',
] as const;
export type DataDomain = (typeof DATA_DOMAINS)[number];

/** What each trade is called, so a screen can name one without a table of its own. */
export const DATA_DOMAIN_LABELS: Readonly<Record<DataDomain, string>> = {
  ARCHITECTURE: 'Architecture',
  STRUCTURE: 'Structure',
  SITE: 'Terrain',
  PLUMBING: 'Plomberie',
  WASTEWATER: 'Évacuation',
  RAINWATER: 'Eaux pluviales',
  HEATING: 'Chauffage',
  VENTILATION: 'Ventilation',
  ELECTRICAL: 'Électricité',
  LIGHTING: 'Éclairage',
  SOLAR: 'Solaire',
  STORAGE: 'Stockage',
  FLUE: 'Fumées',
  DATA: 'Données',
  SAFETY: 'Sécurité',
  FURNITURE: 'Mobilier',
};

export function isDataDomain(value: string): value is DataDomain {
  return (DATA_DOMAINS as readonly string[]).includes(value);
}

export function isDataRegistry(value: string): value is DataRegistry {
  return (DATA_REGISTRIES as readonly string[]).includes(value);
}

/**
 * One record of one registry, at one version.
 *
 * Seven registries name their entries seven different ways — `id` alone here,
 * `familyId` plus `id` there, `family` plus `id` for a product — so nothing
 * could say « this thing, this version » across them, and a project pinning an
 * entry pinned it in whichever shape its own writer had chosen. This is that
 * sentence, said once.
 */
export interface CatalogRef {
  readonly registry: DataRegistry;
  readonly id: string;
  readonly version: string;
}

/**
 * A reference as one string: `EQUIPMENT:generic-air-water-heat-pump@1.0.0`.
 *
 * Registries, identifiers and versions all end up as map keys, file names and
 * lines in a report. Writing the key by hand in each of those places is how
 * two of them come to disagree.
 */
export function formatCatalogRef(ref: CatalogRef): string {
  return `${ref.registry}:${ref.id}@${ref.version}`;
}

const REF_PATTERN = /^([A-Z_]+):([^@\s]+)@([^@\s]+)$/u;

/** The reference a string names, or nothing when it names none. */
export function parseCatalogRef(text: string): CatalogRef | undefined {
  const found = REF_PATTERN.exec(text);
  if (found === null) return undefined;
  const registry = found[1]!;
  return isDataRegistry(registry)
    ? { registry, id: found[2]!, version: found[3]! }
    : undefined;
}

export function catalogRefEquals(
  first: CatalogRef,
  second: CatalogRef,
): boolean {
  return (
    first.registry === second.registry &&
    first.id === second.id &&
    first.version === second.version
  );
}
