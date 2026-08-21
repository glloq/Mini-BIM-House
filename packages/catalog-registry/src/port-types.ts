import type { DataDomain } from './registries.js';

/**
 * What flows through a port, in which direction.
 *
 * A port is not a hole: it is a place where something specific arrives or
 * leaves. A heating flow and a heating return carry the same water and are not
 * interchangeable; a cold water inlet and a wastewater outlet are not even the
 * same fluid. Naming the medium and the direction is what lets the application
 * refuse a connection instead of drawing one that cannot exist.
 */
export type PortDirection = 'IN' | 'OUT' | 'BIDIRECTIONAL';

export interface PortTypeDefinition {
  readonly id: string;
  readonly label: string;
  readonly domain: DataDomain;
  /**
   * What travels: the same medium on both ends is the first condition of a
   * connection, and the only one this registry can check on its own.
   */
  readonly medium: string;
  readonly direction: PortDirection;
  /**
   * The port types this one may be joined to.
   *
   * Left out when the answer is « one of the same medium going the other way »,
   * which is the ordinary case; stated when it is not — a heating flow reaches
   * an emitter's inlet and never another flow.
   */
  readonly connectsTo?: readonly string[];
  readonly hint?: string;
}

/**
 * Every kind of port the application knows.
 *
 * A closed list. A definition that needs a port this list does not hold is a
 * definition asking for a new kind of connection, which is a decision — the
 * alternative is a free string, and a free string means `HEATING_FLOW`,
 * `heating-flow` and `FLOW_HEATING` all existing at once and none of them
 * connecting to the others.
 */
export const PORT_TYPES = [
  // Water
  {
    id: 'WATER_COLD',
    label: 'Eau froide',
    domain: 'PLUMBING',
    medium: 'WATER',
    direction: 'BIDIRECTIONAL',
  },
  {
    id: 'WATER_HOT',
    label: 'Eau chaude sanitaire',
    domain: 'PLUMBING',
    medium: 'WATER',
    direction: 'BIDIRECTIONAL',
  },
  {
    id: 'WATER_RECIRCULATION',
    label: 'Bouclage ECS',
    domain: 'PLUMBING',
    medium: 'WATER',
    direction: 'BIDIRECTIONAL',
  },
  {
    id: 'WATER_NON_POTABLE',
    label: 'Eau non potable',
    domain: 'PLUMBING',
    medium: 'WATER',
    direction: 'BIDIRECTIONAL',
  },
  // Wastewater
  {
    id: 'WASTEWATER',
    label: 'Eaux usées',
    domain: 'WASTEWATER',
    medium: 'WASTEWATER',
    direction: 'OUT',
  },
  {
    id: 'SOILWATER',
    label: 'Eaux-vannes',
    domain: 'WASTEWATER',
    medium: 'WASTEWATER',
    direction: 'OUT',
  },
  {
    id: 'DRAIN_VENT',
    label: 'Ventilation primaire',
    domain: 'WASTEWATER',
    medium: 'AIR',
    direction: 'BIDIRECTIONAL',
  },
  {
    id: 'CONDENSATE',
    label: 'Condensats',
    domain: 'WASTEWATER',
    medium: 'WASTEWATER',
    direction: 'OUT',
  },
  // Rainwater
  {
    id: 'RAINWATER_IN',
    label: 'Eaux pluviales, entrée',
    domain: 'RAINWATER',
    medium: 'RAINWATER',
    direction: 'IN',
  },
  {
    id: 'RAINWATER_OUT',
    label: 'Eaux pluviales, sortie',
    domain: 'RAINWATER',
    medium: 'RAINWATER',
    direction: 'OUT',
  },
  {
    id: 'RAINWATER_OVERFLOW',
    label: 'Trop-plein',
    domain: 'RAINWATER',
    medium: 'RAINWATER',
    direction: 'OUT',
  },
  // Heating
  {
    id: 'HEATING_FLOW',
    label: 'Départ chauffage',
    domain: 'HEATING',
    medium: 'HEATING_WATER',
    direction: 'OUT',
    connectsTo: ['HEATING_RETURN'],
  },
  {
    id: 'HEATING_RETURN',
    label: 'Retour chauffage',
    domain: 'HEATING',
    medium: 'HEATING_WATER',
    direction: 'IN',
    connectsTo: ['HEATING_FLOW'],
  },
  {
    id: 'PRIMARY_FLOW',
    label: 'Départ primaire',
    domain: 'HEATING',
    medium: 'HEATING_WATER',
    direction: 'OUT',
    connectsTo: ['PRIMARY_RETURN'],
  },
  {
    id: 'PRIMARY_RETURN',
    label: 'Retour primaire',
    domain: 'HEATING',
    medium: 'HEATING_WATER',
    direction: 'IN',
    connectsTo: ['PRIMARY_FLOW'],
  },
  // Refrigerant
  {
    id: 'REFRIGERANT_LIQUID',
    label: 'Liquide frigorigène',
    domain: 'HEATING',
    medium: 'REFRIGERANT',
    direction: 'BIDIRECTIONAL',
  },
  {
    id: 'REFRIGERANT_GAS',
    label: 'Gaz frigorigène',
    domain: 'HEATING',
    medium: 'REFRIGERANT',
    direction: 'BIDIRECTIONAL',
  },
  // Ventilation
  {
    id: 'AIR_SUPPLY',
    label: 'Soufflage',
    domain: 'VENTILATION',
    medium: 'AIR',
    direction: 'OUT',
  },
  {
    id: 'AIR_EXTRACT',
    label: 'Extraction',
    domain: 'VENTILATION',
    medium: 'AIR',
    direction: 'IN',
  },
  {
    id: 'AIR_OUTSIDE',
    label: 'Air neuf',
    domain: 'VENTILATION',
    medium: 'AIR',
    direction: 'IN',
  },
  {
    id: 'AIR_EXHAUST',
    label: 'Air rejeté',
    domain: 'VENTILATION',
    medium: 'AIR',
    direction: 'OUT',
  },
  // Flue and combustion
  {
    id: 'FLUE_GAS',
    label: 'Fumées',
    domain: 'FLUE',
    medium: 'FLUE_GAS',
    direction: 'OUT',
  },
  {
    id: 'COMBUSTION_AIR',
    label: 'Air de combustion',
    domain: 'FLUE',
    medium: 'AIR',
    direction: 'IN',
  },
  // Electrical
  {
    id: 'ELECTRICAL_AC',
    label: 'Alimentation alternative',
    domain: 'ELECTRICAL',
    medium: 'ELECTRICITY_AC',
    direction: 'BIDIRECTIONAL',
  },
  {
    id: 'ELECTRICAL_DC',
    label: 'Alimentation continue',
    domain: 'ELECTRICAL',
    medium: 'ELECTRICITY_DC',
    direction: 'BIDIRECTIONAL',
  },
  {
    id: 'PV_DC',
    label: 'Courant continu photovoltaïque',
    domain: 'SOLAR',
    medium: 'ELECTRICITY_DC',
    direction: 'OUT',
  },
  {
    id: 'BATTERY_DC',
    label: 'Courant continu batterie',
    domain: 'STORAGE',
    medium: 'ELECTRICITY_DC',
    direction: 'BIDIRECTIONAL',
  },
  {
    id: 'EARTH',
    label: 'Terre',
    domain: 'ELECTRICAL',
    medium: 'EARTH',
    direction: 'BIDIRECTIONAL',
  },
  // Control and data
  {
    id: 'CONTROL',
    label: 'Commande',
    domain: 'DATA',
    medium: 'SIGNAL',
    direction: 'BIDIRECTIONAL',
  },
  {
    id: 'DRY_CONTACT',
    label: 'Contact sec',
    domain: 'DATA',
    medium: 'SIGNAL',
    direction: 'BIDIRECTIONAL',
  },
  {
    id: 'ETHERNET',
    label: 'Ethernet',
    domain: 'DATA',
    medium: 'DATA',
    direction: 'BIDIRECTIONAL',
  },
  {
    id: 'FIBER',
    label: 'Fibre optique',
    domain: 'DATA',
    medium: 'DATA',
    direction: 'BIDIRECTIONAL',
  },
  {
    id: 'COAX',
    label: 'Coaxial',
    domain: 'DATA',
    medium: 'DATA',
    direction: 'BIDIRECTIONAL',
  },
  {
    id: 'BUS',
    label: 'Bus de terrain',
    domain: 'DATA',
    medium: 'DATA',
    direction: 'BIDIRECTIONAL',
  },
  {
    id: 'WIRELESS',
    label: 'Sans fil',
    domain: 'DATA',
    medium: 'DATA',
    direction: 'BIDIRECTIONAL',
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

/**
 * Whether two ports may be joined.
 *
 * The medium has to be the same — nothing joins a pipe to a cable — and the
 * directions have to face each other. When a port names what it connects to,
 * that list decides instead: a heating flow reaches a return and never another
 * flow, whatever the directions would otherwise allow.
 */
export function portsConnect(first: string, second: string): boolean {
  const from = BY_ID.get(first);
  const to = BY_ID.get(second);
  if (from === undefined || to === undefined) return false;
  if (from.connectsTo !== undefined) return from.connectsTo.includes(second);
  if (to.connectsTo !== undefined) return to.connectsTo.includes(first);
  if (from.medium !== to.medium) return false;
  if (from.direction === 'BIDIRECTIONAL' || to.direction === 'BIDIRECTIONAL')
    return true;
  return from.direction !== to.direction;
}
