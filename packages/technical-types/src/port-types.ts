import type { DataDomain } from './registries.js';

/**
 * What flows through a port, in which direction.
 *
 * A port is not a hole: it is a place where something specific arrives or
 * leaves.
 */
export type PortDirection = 'IN' | 'OUT' | 'BIDIRECTIONAL';

/**
 * What a port carries, at the coarsest level: water, air, electricity.
 *
 * The medium alone is not enough to decide a connection, and treating it as
 * though it were is what let cold water reach hot water, a drain vent reach a
 * supply duct, and a photovoltaic string reach a battery. They share a medium
 * and nothing else.
 */
export const PORT_MEDIA = [
  'WATER',
  'WASTEWATER',
  'RAINWATER',
  'HEATING_WATER',
  'CHILLED_WATER',
  'FUEL',
  'REFRIGERANT',
  'AIR',
  'FLUE_GAS',
  'ELECTRICITY_AC',
  'ELECTRICITY_DC',
  'EARTH',
  'SIGNAL',
  'DATA',
] as const;
export type PortMedium = (typeof PORT_MEDIA)[number];

/**
 * What the medium is being used for, which is what actually decides.
 *
 * Cold water and hot water are both water and are not the same service; a
 * photovoltaic string and a battery are both direct current and do not join
 * without a converter between them. Two ports connect when they serve the same
 * thing, not when they carry the same fluid.
 */
export const PORT_SERVICES = [
  'POTABLE_COLD',
  'POTABLE_HOT',
  'DHW_RECIRCULATION',
  'NON_POTABLE',
  'GREYWATER',
  'BLACKWATER',
  /** Les deux réunies, ce qu'un réseau unitaire transporte en aval du regard. */
  'COMBINED_WASTEWATER',
  'DRAIN_VENT',
  'CONDENSATE',
  'RAINWATER',
  'RAINWATER_OVERFLOW',
  'HEATING_CIRCUIT',
  'PRIMARY_CIRCUIT',
  'CHILLED_CIRCUIT',
  'FUEL_GAS',
  'FUEL_OIL',
  'FUEL_PELLET',
  'REFRIGERANT_LIQUID',
  'REFRIGERANT_GAS',
  'SUPPLY_AIR',
  'EXTRACT_AIR',
  'OUTSIDE_AIR',
  'EXHAUST_AIR',
  'COMBUSTION_AIR',
  'FLUE',
  'AC_POWER',
  'PV_STRING',
  'BATTERY',
  'EARTHING',
  'CONTROL',
  'DRY_CONTACT',
  'ETHERNET',
  'FIBER',
  'COAX',
  'FIELDBUS',
  'WIRELESS',
] as const;
export type PortService = (typeof PORT_SERVICES)[number];

/**
 * The physical fitting, which decides whether two ends actually go together.
 *
 * Two ports of the same service still have to be joinable: a 22 mm compression
 * fitting and a 100 mm socket serve the same water and do not meet. The class
 * is coarse on purpose — it says what kind of joint, not what size — because
 * the size belongs to the product and is checked against it.
 */
export const CONNECTION_CLASSES = [
  'PIPE_PRESSURE',
  'PIPE_GRAVITY',
  'PIPE_REFRIGERANT',
  'PIPE_FUEL',
  'BULK_CONVEYOR',
  'DUCT',
  'FLUE',
  'ELECTRICAL_TERMINAL',
  'DATA_TERMINAL',
  'WIRELESS',
] as const;
export type ConnectionClass = (typeof CONNECTION_CLASSES)[number];

export interface PortTypeDefinition {
  readonly id: string;
  readonly label: string;
  readonly domain: DataDomain;
  readonly medium: PortMedium;
  readonly service: PortService;
  readonly direction: PortDirection;
  readonly connectionClass: ConnectionClass;
  /**
   * Port types this one may be joined to beyond its own service.
   *
   * Stated only where a connection crosses services on purpose, which is what
   * a converter is: an inverter joins a photovoltaic string on one side and
   * alternating current on the other, and nothing else may.
   */
  readonly convertsTo?: readonly string[];
  readonly hint?: string;
}

/**
 * Every kind of port the application knows.
 *
 * A closed list. A definition needing a port this list does not hold is asking
 * for a new kind of connection, which is a decision; a free string means
 * `HEATING_FLOW`, `heating-flow` and `FLOW_HEATING` all exist and none of them
 * connects to the others.
 */
export const PORT_TYPES = [
  // Water
  {
    id: 'WATER_COLD',
    label: 'Eau froide',
    domain: 'PLUMBING',
    medium: 'WATER',
    service: 'POTABLE_COLD',
    direction: 'BIDIRECTIONAL',
    connectionClass: 'PIPE_PRESSURE',
  },
  {
    id: 'WATER_HOT',
    label: 'Eau chaude sanitaire',
    domain: 'PLUMBING',
    medium: 'WATER',
    service: 'POTABLE_HOT',
    direction: 'BIDIRECTIONAL',
    connectionClass: 'PIPE_PRESSURE',
  },
  {
    id: 'WATER_RECIRCULATION',
    label: 'Bouclage ECS',
    domain: 'PLUMBING',
    medium: 'WATER',
    service: 'DHW_RECIRCULATION',
    direction: 'BIDIRECTIONAL',
    connectionClass: 'PIPE_PRESSURE',
  },
  {
    id: 'WATER_NON_POTABLE',
    label: 'Eau non potable',
    domain: 'PLUMBING',
    medium: 'WATER',
    service: 'NON_POTABLE',
    direction: 'BIDIRECTIONAL',
    connectionClass: 'PIPE_PRESSURE',
  },
  // Wastewater
  {
    id: 'WASTEWATER',
    label: 'Eaux usées',
    domain: 'WASTEWATER',
    medium: 'WASTEWATER',
    service: 'GREYWATER',
    direction: 'OUT',
    connectionClass: 'PIPE_GRAVITY',
  },
  {
    id: 'WASTEWATER_INLET',
    label: 'Arrivée d’eaux usées',
    domain: 'WASTEWATER',
    medium: 'WASTEWATER',
    service: 'GREYWATER',
    direction: 'IN',
    connectionClass: 'PIPE_GRAVITY',
  },
  {
    id: 'SOILWATER',
    label: 'Eaux-vannes',
    domain: 'WASTEWATER',
    medium: 'WASTEWATER',
    service: 'BLACKWATER',
    direction: 'OUT',
    connectionClass: 'PIPE_GRAVITY',
  },
  {
    id: 'SOILWATER_INLET',
    label: 'Arrivée d’eaux-vannes',
    domain: 'WASTEWATER',
    medium: 'WASTEWATER',
    service: 'BLACKWATER',
    direction: 'IN',
    connectionClass: 'PIPE_GRAVITY',
  },
  /*
   * Un réseau unitaire, qui est le cas courant d'une maison.
   *
   * `WastewaterSystemType` connaît `COMBINED_WASTEWATER` depuis toujours, et
   * aucun type de port ne savait le dire : en aval du regard, un tuyau porte
   * les eaux usées **et** les eaux-vannes, et le modèle n'avait que les deux
   * séparément. Raccorder un lavabo au même regard que le WC était donc refusé
   * — dans la maison de référence elle-même, où plus rien ne pouvait être
   * vérifié faute de types déclarés.
   *
   * L'arrivée unitaire est le seul endroit où deux services se rejoignent, et
   * elle le dit : c'est exactement ce que `convertsTo` décrit — « énoncé
   * seulement là où une liaison traverse les services exprès ». Un regard
   * unitaire est ce croisement, comme un onduleur en est un entre le continu
   * et l'alternatif.
   */
  {
    id: 'WASTEWATER_COMBINED',
    label: 'Eaux usées unitaires',
    domain: 'WASTEWATER',
    medium: 'WASTEWATER',
    service: 'COMBINED_WASTEWATER',
    direction: 'OUT',
    connectionClass: 'PIPE_GRAVITY',
  },
  {
    id: 'WASTEWATER_COMBINED_INLET',
    label: 'Arrivée unitaire',
    domain: 'WASTEWATER',
    medium: 'WASTEWATER',
    service: 'COMBINED_WASTEWATER',
    direction: 'IN',
    connectionClass: 'PIPE_GRAVITY',
    convertsTo: ['WASTEWATER', 'SOILWATER', 'CONDENSATE'],
  },
  {
    id: 'DRAIN_VENT',
    label: 'Ventilation primaire',
    domain: 'WASTEWATER',
    medium: 'AIR',
    service: 'DRAIN_VENT',
    direction: 'BIDIRECTIONAL',
    connectionClass: 'PIPE_GRAVITY',
  },
  {
    id: 'CONDENSATE',
    label: 'Condensats',
    domain: 'WASTEWATER',
    medium: 'WASTEWATER',
    service: 'CONDENSATE',
    direction: 'OUT',
    connectionClass: 'PIPE_GRAVITY',
  },
  {
    id: 'CONDENSATE_INLET',
    label: 'Arrivée de condensats',
    domain: 'WASTEWATER',
    medium: 'WASTEWATER',
    service: 'CONDENSATE',
    direction: 'IN',
    connectionClass: 'PIPE_GRAVITY',
  },
  // Rainwater
  {
    id: 'RAINWATER_IN',
    label: 'Eaux pluviales, entrée',
    domain: 'RAINWATER',
    medium: 'RAINWATER',
    service: 'RAINWATER',
    direction: 'IN',
    connectionClass: 'PIPE_GRAVITY',
  },
  {
    id: 'RAINWATER_OUT',
    label: 'Eaux pluviales, sortie',
    domain: 'RAINWATER',
    medium: 'RAINWATER',
    service: 'RAINWATER',
    direction: 'OUT',
    connectionClass: 'PIPE_GRAVITY',
  },
  {
    id: 'RAINWATER_OVERFLOW',
    label: 'Trop-plein',
    domain: 'RAINWATER',
    medium: 'RAINWATER',
    service: 'RAINWATER_OVERFLOW',
    direction: 'OUT',
    connectionClass: 'PIPE_GRAVITY',
  },
  {
    id: 'RAINWATER_OVERFLOW_INLET',
    label: 'Reprise de trop-plein',
    domain: 'RAINWATER',
    medium: 'RAINWATER',
    service: 'RAINWATER_OVERFLOW',
    direction: 'IN',
    connectionClass: 'PIPE_GRAVITY',
  },
  // Heating
  {
    id: 'HEATING_FLOW',
    label: 'Départ chauffage',
    domain: 'HEATING',
    medium: 'HEATING_WATER',
    service: 'HEATING_CIRCUIT',
    direction: 'OUT',
    connectionClass: 'PIPE_PRESSURE',
  },
  {
    id: 'HEATING_RETURN',
    label: 'Retour chauffage',
    domain: 'HEATING',
    medium: 'HEATING_WATER',
    service: 'HEATING_CIRCUIT',
    direction: 'IN',
    connectionClass: 'PIPE_PRESSURE',
  },
  {
    id: 'PRIMARY_FLOW',
    label: 'Départ primaire',
    domain: 'HEATING',
    medium: 'HEATING_WATER',
    service: 'PRIMARY_CIRCUIT',
    direction: 'OUT',
    connectionClass: 'PIPE_PRESSURE',
  },
  {
    id: 'PRIMARY_RETURN',
    label: 'Retour primaire',
    domain: 'HEATING',
    medium: 'HEATING_WATER',
    service: 'PRIMARY_CIRCUIT',
    direction: 'IN',
    connectionClass: 'PIPE_PRESSURE',
  },
  // Refrigerant
  // Chilled water and fuel: two media a house holds and the registry could not
  // name. A cooling coil fed by water was inexpressible, so the catalogue's
  // was on direct expansion — a product decision imposed by the format. And
  // none of the three boilers could say where what it burns arrives from,
  // which is the appliance's whole reason for existing.
  {
    id: 'CHILLED_FLOW',
    label: 'Départ eau glacée',
    domain: 'VENTILATION',
    medium: 'CHILLED_WATER',
    service: 'CHILLED_CIRCUIT',
    direction: 'OUT',
    connectionClass: 'PIPE_PRESSURE',
  },
  {
    id: 'CHILLED_RETURN',
    label: 'Retour eau glacée',
    domain: 'VENTILATION',
    medium: 'CHILLED_WATER',
    service: 'CHILLED_CIRCUIT',
    direction: 'IN',
    connectionClass: 'PIPE_PRESSURE',
  },
  {
    id: 'FUEL_GAS',
    label: 'Arrivée de gaz',
    domain: 'HEATING',
    medium: 'FUEL',
    service: 'FUEL_GAS',
    direction: 'IN',
    connectionClass: 'PIPE_FUEL',
  },
  {
    id: 'FUEL_GAS_SUPPLY',
    label: 'Départ de gaz',
    domain: 'HEATING',
    medium: 'FUEL',
    service: 'FUEL_GAS',
    direction: 'OUT',
    connectionClass: 'PIPE_FUEL',
    hint: 'Le côté réseau : branchement, compteur, organe de coupure.',
  },
  {
    id: 'FUEL_OIL',
    label: 'Arrivée de fioul',
    domain: 'HEATING',
    medium: 'FUEL',
    service: 'FUEL_OIL',
    direction: 'IN',
    connectionClass: 'PIPE_FUEL',
  },
  {
    id: 'FUEL_OIL_SUPPLY',
    label: 'Départ de fioul',
    domain: 'HEATING',
    medium: 'FUEL',
    service: 'FUEL_OIL',
    direction: 'OUT',
    connectionClass: 'PIPE_FUEL',
  },
  {
    id: 'FUEL_PELLET',
    label: 'Arrivée de granulés',
    domain: 'HEATING',
    medium: 'FUEL',
    service: 'FUEL_PELLET',
    direction: 'IN',
    connectionClass: 'BULK_CONVEYOR',
    hint: 'Vis sans fin ou aspiration ; une chaudière à bûches se charge à la main et n’a pas de port.',
  },
  {
    id: 'FUEL_PELLET_SUPPLY',
    label: 'Départ de granulés',
    domain: 'HEATING',
    medium: 'FUEL',
    service: 'FUEL_PELLET',
    direction: 'OUT',
    connectionClass: 'BULK_CONVEYOR',
  },
  {
    id: 'REFRIGERANT_LIQUID',
    label: 'Liquide frigorigène',
    domain: 'HEATING',
    medium: 'REFRIGERANT',
    service: 'REFRIGERANT_LIQUID',
    direction: 'BIDIRECTIONAL',
    connectionClass: 'PIPE_REFRIGERANT',
  },
  {
    id: 'REFRIGERANT_GAS',
    label: 'Gaz frigorigène',
    domain: 'HEATING',
    medium: 'REFRIGERANT',
    service: 'REFRIGERANT_GAS',
    direction: 'BIDIRECTIONAL',
    connectionClass: 'PIPE_REFRIGERANT',
  },
  // Ventilation
  {
    id: 'AIR_SUPPLY',
    label: 'Soufflage',
    domain: 'VENTILATION',
    medium: 'AIR',
    service: 'SUPPLY_AIR',
    direction: 'OUT',
    connectionClass: 'DUCT',
  },
  {
    id: 'AIR_SUPPLY_INLET',
    label: 'Reprise de soufflage',
    domain: 'VENTILATION',
    medium: 'AIR',
    service: 'SUPPLY_AIR',
    direction: 'IN',
    connectionClass: 'DUCT',
  },
  {
    id: 'AIR_EXTRACT',
    label: 'Extraction',
    domain: 'VENTILATION',
    medium: 'AIR',
    service: 'EXTRACT_AIR',
    direction: 'IN',
    connectionClass: 'DUCT',
  },
  {
    id: 'AIR_EXTRACT_OUTLET',
    label: 'Reprise d’extraction',
    domain: 'VENTILATION',
    medium: 'AIR',
    service: 'EXTRACT_AIR',
    direction: 'OUT',
    connectionClass: 'DUCT',
  },
  {
    id: 'AIR_OUTSIDE',
    label: 'Air neuf',
    domain: 'VENTILATION',
    medium: 'AIR',
    service: 'OUTSIDE_AIR',
    direction: 'IN',
    connectionClass: 'DUCT',
  },
  {
    id: 'AIR_OUTSIDE_SOURCE',
    label: 'Prise d’air neuf',
    domain: 'VENTILATION',
    medium: 'AIR',
    service: 'OUTSIDE_AIR',
    direction: 'OUT',
    connectionClass: 'DUCT',
  },
  {
    id: 'AIR_EXHAUST',
    label: 'Air rejeté',
    domain: 'VENTILATION',
    medium: 'AIR',
    service: 'EXHAUST_AIR',
    direction: 'OUT',
    connectionClass: 'DUCT',
  },
  {
    id: 'AIR_EXHAUST_OUTLET',
    label: 'Rejet extérieur',
    domain: 'VENTILATION',
    medium: 'AIR',
    service: 'EXHAUST_AIR',
    direction: 'IN',
    connectionClass: 'DUCT',
  },
  // Flue and combustion
  {
    id: 'FLUE_GAS',
    label: 'Fumées',
    domain: 'FLUE',
    medium: 'FLUE_GAS',
    service: 'FLUE',
    direction: 'OUT',
    connectionClass: 'FLUE',
  },
  {
    id: 'FLUE_GAS_INLET',
    label: 'Arrivée de fumées',
    domain: 'FLUE',
    medium: 'FLUE_GAS',
    service: 'FLUE',
    direction: 'IN',
    connectionClass: 'FLUE',
  },
  {
    id: 'COMBUSTION_AIR',
    label: 'Air de combustion',
    domain: 'FLUE',
    medium: 'AIR',
    service: 'COMBUSTION_AIR',
    direction: 'IN',
    connectionClass: 'DUCT',
  },
  {
    id: 'COMBUSTION_AIR_SOURCE',
    label: 'Amenée d’air de combustion',
    domain: 'FLUE',
    medium: 'AIR',
    service: 'COMBUSTION_AIR',
    direction: 'OUT',
    connectionClass: 'DUCT',
  },
  // Electrical
  {
    id: 'ELECTRICAL_AC',
    label: 'Alimentation alternative',
    domain: 'ELECTRICAL',
    medium: 'ELECTRICITY_AC',
    service: 'AC_POWER',
    direction: 'BIDIRECTIONAL',
    connectionClass: 'ELECTRICAL_TERMINAL',
  },
  {
    id: 'PV_DC',
    label: 'Courant continu photovoltaïque',
    domain: 'SOLAR',
    medium: 'ELECTRICITY_DC',
    service: 'PV_STRING',
    direction: 'OUT',
    connectionClass: 'ELECTRICAL_TERMINAL',
  },
  {
    id: 'PV_DC_INPUT',
    label: 'Entrée continue photovoltaïque',
    domain: 'SOLAR',
    medium: 'ELECTRICITY_DC',
    service: 'PV_STRING',
    direction: 'IN',
    connectionClass: 'ELECTRICAL_TERMINAL',
  },
  {
    id: 'BATTERY_DC',
    label: 'Courant continu batterie',
    domain: 'STORAGE',
    medium: 'ELECTRICITY_DC',
    service: 'BATTERY',
    direction: 'BIDIRECTIONAL',
    connectionClass: 'ELECTRICAL_TERMINAL',
  },
  {
    id: 'ELECTRICAL_AC_INPUT',
    label: 'Arrivée alternative',
    domain: 'ELECTRICAL',
    medium: 'ELECTRICITY_AC',
    service: 'AC_POWER',
    direction: 'IN',
    connectionClass: 'ELECTRICAL_TERMINAL',
    hint: 'L’amont d’un appareil en ligne : compteur, sectionneur, coupure d’urgence.',
  },
  {
    id: 'BATTERY_DC_INPUT',
    label: 'Arrivée continue batterie',
    domain: 'STORAGE',
    medium: 'ELECTRICITY_DC',
    service: 'BATTERY',
    direction: 'IN',
    connectionClass: 'ELECTRICAL_TERMINAL',
  },
  {
    id: 'EARTH',
    label: 'Terre',
    domain: 'ELECTRICAL',
    medium: 'EARTH',
    service: 'EARTHING',
    direction: 'BIDIRECTIONAL',
    connectionClass: 'ELECTRICAL_TERMINAL',
  },
  // Control and data
  {
    id: 'CONTROL',
    label: 'Commande',
    domain: 'DATA',
    medium: 'SIGNAL',
    service: 'CONTROL',
    direction: 'BIDIRECTIONAL',
    connectionClass: 'DATA_TERMINAL',
  },
  {
    id: 'DRY_CONTACT',
    label: 'Contact sec',
    domain: 'DATA',
    medium: 'SIGNAL',
    service: 'DRY_CONTACT',
    direction: 'BIDIRECTIONAL',
    connectionClass: 'DATA_TERMINAL',
  },
  {
    id: 'ETHERNET',
    label: 'Ethernet',
    domain: 'DATA',
    medium: 'DATA',
    service: 'ETHERNET',
    direction: 'BIDIRECTIONAL',
    connectionClass: 'DATA_TERMINAL',
  },
  {
    id: 'FIBER',
    label: 'Fibre optique',
    domain: 'DATA',
    medium: 'DATA',
    service: 'FIBER',
    direction: 'BIDIRECTIONAL',
    connectionClass: 'DATA_TERMINAL',
  },
  {
    id: 'COAX',
    label: 'Coaxial',
    domain: 'DATA',
    medium: 'DATA',
    service: 'COAX',
    direction: 'BIDIRECTIONAL',
    connectionClass: 'DATA_TERMINAL',
  },
  {
    id: 'BUS',
    label: 'Bus de terrain',
    domain: 'DATA',
    medium: 'DATA',
    service: 'FIELDBUS',
    direction: 'BIDIRECTIONAL',
    connectionClass: 'DATA_TERMINAL',
  },
  {
    id: 'WIRELESS',
    label: 'Sans fil',
    domain: 'DATA',
    medium: 'DATA',
    service: 'WIRELESS',
    direction: 'BIDIRECTIONAL',
    connectionClass: 'WIRELESS',
    hint: 'Aucun tracé : le port existe pour dire que l’appareil communique.',
  },
] as const satisfies readonly PortTypeDefinition[];

export type PortTypeId = (typeof PORT_TYPES)[number]['id'];

const BY_ID = new Map<string, PortTypeDefinition>(
  PORT_TYPES.map((type) => [type.id, type]),
);

export function portType(id: string): PortTypeDefinition | undefined {
  return BY_ID.get(id);
}

export function isPortType(id: string): id is PortTypeId {
  return BY_ID.has(id);
}

/** Why two ports cannot be joined, in words, or nothing when they can. */
export function connectionRefusal(
  first: string,
  second: string,
): string | undefined {
  const from = BY_ID.get(first);
  const to = BY_ID.get(second);
  if (from === undefined) return `${first} n’est pas un type de port connu`;
  if (to === undefined) return `${second} n’est pas un type de port connu`;
  // A converter is the one thing that may cross services, and it says which.
  if (from.convertsTo?.includes(second) === true) return undefined;
  if (to.convertsTo?.includes(first) === true) return undefined;
  if (from.medium !== to.medium)
    return `${from.medium} ne rejoint pas ${to.medium}`;
  if (from.service !== to.service)
    return `${from.service} et ${to.service} ne sont pas le même service`;
  if (from.connectionClass !== to.connectionClass)
    return `${from.connectionClass} et ${to.connectionClass} ne se raccordent pas`;
  if (from.direction !== 'BIDIRECTIONAL' && from.direction === to.direction)
    return `deux ports ${from.direction} ne se font pas face`;
  return undefined;
}

/**
 * Whether two ports may be joined.
 *
 * The medium, the service, the fitting and the directions all have to agree.
 * Deciding on the medium alone let cold water reach hot water, a drain vent
 * reach a supply duct, an exhaust reach a combustion air intake and a
 * photovoltaic string reach a battery — every one of them a connection that
 * cannot exist, offered by a tool meant to check connections.
 */
export function portsConnect(first: string, second: string): boolean {
  return connectionRefusal(first, second) === undefined;
}
