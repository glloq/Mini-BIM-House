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

export function isDataDomain(value: string): value is DataDomain {
  return (DATA_DOMAINS as readonly string[]).includes(value);
}

export function isDataRegistry(value: string): value is DataRegistry {
  return (DATA_REGISTRIES as readonly string[]).includes(value);
}
