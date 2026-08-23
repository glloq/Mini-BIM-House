/**
 * Gives every equipment family the word that says what it is.
 *
 * `EQUIPMENT_CATEGORIES` held twenty values, and two hundred and one families
 * of the nomenclature answered `OTHER` — exact, and useless: the index by
 * category could not answer « montre-moi le mobilier », « montre-moi les
 * vannes » or « montre-moi les prises de terre », because none of those was a
 * word the application knew. CG-04 recorded that rather than lengthening the
 * list under the pressure of a fiche in a hurry; this is the deliberate
 * lengthening it asked for.
 *
 * The table below is the whole decision, one family at a time. It is a script
 * rather than a hand edit of ten thousand lines of JSON because a
 * reassignment nobody can re-read is a reassignment nobody can check: run it
 * again and it says the same thing, or it fails.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const ASSIGNED: Readonly<Record<string, readonly string[]>> = {
  // Ce qui meuble, et ce qui sert.
  FURNITURE: [
    'BED',
    'SOFA',
    'CHAIR',
    'TABLE',
    'DESK',
    'WARDROBE',
    'CABINET',
    'KITCHEN_CABINET',
    'WORKTOP',
    'SHELF',
  ],
  APPLIANCE: [
    'DISHWASHER',
    'WASHING_MACHINE',
    'DRYER',
    'OVEN',
    'HOB',
    'MICROWAVE',
    'REFRIGERATOR',
    'FREEZER',
    'EV_CHARGER',
    'SITE_EV_CHARGER',
  ],

  // Ce qui ouvre, ferme, limite ou mélange un débit.
  VALVE: [
    'ISOLATION_VALVE',
    'MAIN_VALVE',
    'CHECK_VALVE',
    'BALANCING_VALVE',
    'DRAIN_VALVE',
    'BACKFLOW_PREVENTER',
    'PRESSURE_REDUCER',
    'SAFETY_GROUP',
    'THERMOSTATIC_MIXER',
    'THERMOSTATIC_MIXING_VALVE',
    'AIR_VENT',
    'HEATING_AIR_VENT',
    'HEATING_BALANCING_VALVE',
    'HEATING_CHECK_VALVE',
    'HEATING_ISOLATION_VALVE',
    'MIXING_VALVE',
    'SAFETY_VALVE',
    'THREE_WAY_VALVE',
    'BACKWATER_VALVE',
  ],

  // Ce qui change la direction, la section ou le nombre d'un tracé.
  FITTING: [
    'ELBOW',
    'TEE',
    'COUPLING',
    'REDUCER',
    'MANIFOLD',
    'HEATING_MANIFOLD',
    'BRANCH_JOINT',
    'Y_BRANCH',
    'TRANSITION',
    'REFNET',
    'PLENUM',
    'VENTILATION_ELBOW',
    'VENTILATION_TEE',
    'VENTILATION_REDUCER',
    'SANITARY_TEE',
    'WYE',
    'LONG_RADIUS_BEND',
    'WASTE_REDUCER',
    'SOIL_BRANCH',
    'WASTE_BRANCH',
    'APPLIANCE_BRANCH',
    'ACCESS_CAP',
    'CLEANOUT',
    'STOVE_COLLAR',
    'FLUE_ADAPTER',
    'FLUE_ELBOW',
    'FLUE_TEE',
    'FLUE_CLEANOUT',
  ],

  // Ce qui traite l'eau avant qu'on la boive.
  WATER_TREATMENT: [
    'WATER_SOFTENER',
    'CARBON_FILTER',
    'SEDIMENT_FILTER',
    'UV_TREATMENT',
    'FILTER',
  ],

  // Ce qui emmène et traite ce qu'on rejette.
  DRAINAGE: [
    'SEPTIC_TANK',
    'SITE_SEPTIC_TANK',
    'MICRO_TREATMENT_PLANT',
    'SITE_MICRO_TREATMENT_PLANT',
    'GREASE_TRAP',
    'INSPECTION_CHAMBER',
    'SEWER_CHAMBER',
    'SITE_DRAIN',
    'DRAIN_FIELD',
    'SOIL_STACK',
    'WASTE_STACK',
    'VENT_STACK',
    'SECONDARY_VENT',
    'TRAP',
    'PUBLIC_SEWER_CONNECTION',
  ],

  // Ce qui recueille, retient ou infiltre la pluie.
  RAINWATER_DEVICE: [
    'GUTTER',
    'BOX_GUTTER',
    'VALLEY_GUTTER',
    'DOWNPIPE',
    'ROOF_DRAIN',
    'ROOF_CATCHMENT',
    'LEAF_GUARD',
    'RAIN_FILTER',
    'FIRST_FLUSH',
    'OVERFLOW',
    'SOAKAWAY',
    'INFILTRATION_TRENCH',
    'SWALE',
    'RETENTION_BASIN',
    'DETENTION_BASIN',
    'RAINWATER_CHAMBER',
    'SITE_RAINWATER_CHAMBER',
    'PUBLIC_STORM_CONNECTION',
  ],

  // Ce qui met à la terre.
  EARTHING_DEVICE: [
    'EARTH_ROD',
    'SITE_EARTH_ROD',
    'EARTH_BAR',
    'EARTH_ELECTRODE',
    'MAIN_EARTHING_TERMINAL',
    'FOUNDATION_EARTH_LOOP',
    'EQUIPOTENTIAL_BONDING',
    'BATHROOM_BONDING',
    'PROTECTIVE_CONDUCTOR',
    'SPD_EARTH_CONNECTION',
  ],

  // Ce qui commande. Quatre de ces familles étaient rangées en
  // `PROTECTION_DEVICE` faute de mieux : un contacteur ne protège rien.
  CONTROL_DEVICE: [
    'SWITCH',
    'TWO_WAY_SWITCH',
    'INTERMEDIATE_SWITCH',
    'DOUBLE_SWITCH',
    'PUSH_BUTTON',
    'DIMMER',
    'ROLLER_SHUTTER_SWITCH',
    'ROLLER_SHUTTER_ACTUATOR',
    'LIGHTING_CONTROLLER',
    'ACTUATOR',
    'BMS',
    'CONTACTOR',
    'RELAY',
    'TIMER',
    'LOAD_SHEDDING_RELAY',
    'EXPORT_LIMITER',
    'ROOM_THERMOSTAT',
  ],

  // Ce qui porte et abrite les câbles.
  CABLE_ROUTING: [
    'CABLE_TRAY',
    'CABLE_LADDER',
    'JUNCTION_BOX',
    'WALL_BOX',
    'FLOOR_BOX',
    'TERMINAL_BLOCK',
  ],

  // Ce qui compte. Sept familles étaient rangées en `SENSOR` : un compteur
  // mesure une quantité cumulée, un capteur un état instantané, et la
  // différence est celle entre une facture et une consigne.
  METER: [
    'UTILITY_METER',
    'SERVICE_METER',
    'SITE_WATER_METER',
    'WATER_METER',
    'ENERGY_METER',
    'ELECTRICAL_SUB_METER',
    'SUB_METER',
    'FLOW_METER',
    'PRODUCTION_METER',
  ],

  // Ce qui transporte de l'information.
  DATA_DEVICE: [
    'ROUTER',
    'NETWORK_SWITCH',
    'NETWORK_RACK',
    'PATCH_PANEL',
    'FIBER_TERMINATION',
    'RJ45_SOCKET',
    'COAX_SOCKET',
    'WIFI_ACCESS_POINT',
    'KNX_DEVICE',
    'MATTER_DEVICE',
    'MODBUS_DEVICE',
    'THREAD_DEVICE',
    'ZIGBEE_DEVICE',
    'DATA_RELAY',
  ],

  // Ce qui alerte, surveille ou éteint.
  SAFETY_DEVICE: [
    'ALARM_PANEL',
    'SIREN',
    'CAMERA',
    'INTERCOM',
    'VIDEO_DOORBELL',
    'EMERGENCY_STOP',
    'EXTINGUISHER',
    'FIRE_BLANKET',
  ],

  // Ce qui évacue les fumées et amène l'air comburant.
  FLUE_COMPONENT: [
    'SINGLE_WALL_FLUE',
    'INSULATED_FLUE',
    'FLEXIBLE_LINER',
    'CHIMNEY_CAP',
    'CHIMNEY_TERMINAL',
    'ROOF_PASSAGE',
    'WALL_PASSAGE',
    'FLOOR_PASSAGE',
    'COMBUSTION_AIR_DUCT',
    'COMBUSTION_AIR_INTAKE',
    'EXTERNAL_AIR_TERMINAL',
  ],

  // Ce qui brûle du bois dans la pièce où il chauffe.
  STOVE: [
    'WOOD_STOVE',
    'PELLET_STOVE',
    'WOOD_INSERT',
    'PELLET_INSERT',
    'FIREPLACE',
    'BOILER_STOVE',
  ],

  // Ce qui fait passer la chaleur d'un fluide à un autre.
  HEAT_EXCHANGER: [
    'HEATING_COIL',
    'COOLING_COIL',
    'DISTRICT_HEATING_INTERFACE',
    'SOLAR_THERMAL',
  ],

  // Ce qui tient un volume sous pression.
  VESSEL: [
    'EXPANSION_VESSEL',
    'PRESSURE_VESSEL',
    'HEATING_EXPANSION_VESSEL',
    'BUFFER_TANK',
  ],

  // Ce qui sépare, purge ou filtre un circuit humide.
  HYDRAULIC_ACCESSORY: [
    'AIR_SEPARATOR',
    'DIRT_SEPARATOR',
    'HYDRAULIC_SEPARATOR',
    'MAGNETIC_FILTER',
    'CONDENSATE_DRAIN',
  ],

  // Ce qui règle, atténue ou filtre un circuit d'air.
  AIR_ACCESSORY: [
    'DAMPER',
    'BALANCING_DAMPER',
    'BACKDRAFT_DAMPER',
    'FIRE_DAMPER',
    'SILENCER',
    'VENTILATION_FILTER',
    'VENTILATION_CONDENSATE_TRAP',
  ],

  // Ce qui porte un module ou un capteur.
  MOUNTING: ['GROUND_MOUNT', 'ROOF_HOOK', 'ROOF_RAIL'],

  // Ce qui est sur la parcelle et n'est pas un bâtiment.
  SITE_FEATURE: [
    'BOREHOLE',
    'WELL',
    'WATER_CHAMBER',
    'WATER_PUBLIC_CONNECTION',
  ],
};

/**
 * Ce qui reste `OTHER`, et pourquoi.
 *
 * Une catégorie pour un seul objet est un mot que personne ne cherchera. Un
 * optimiseur n'est ni un module ni un onduleur : c'est de l'électronique de
 * puissance au niveau du module, et le jour où il y en aura trois sortes, la
 * liste s'allongera encore — délibérément, comme aujourd'hui.
 */
const STAYS: readonly string[] = ['OPTIMIZER'];

const files = globSync('packages/catalog-registry/data/families/**/*.json');
const wanted = new Map<string, string>();
for (const [category, ids] of Object.entries(ASSIGNED))
  for (const id of ids) {
    if (wanted.has(id)) {
      console.error(
        `${id} est rangé deux fois : ${wanted.get(id)!}, ${category}`,
      );
      process.exit(1);
    }
    wanted.set(id, category);
  }

let moved = 0;
const seen = new Set<string>();
const left: string[] = [];
for (const file of files) {
  const held = JSON.parse(readFileSync(file, 'utf8')) as {
    families?: { id: string; registry?: string; category?: string }[];
  };
  let touched = false;
  for (const family of held.families ?? []) {
    if (family.registry !== 'EQUIPMENT') continue;
    const category = wanted.get(family.id);
    if (category === undefined) {
      if (family.category === 'OTHER' && !STAYS.includes(family.id))
        left.push(family.id);
      continue;
    }
    seen.add(family.id);
    if (family.category === category) continue;
    family.category = category;
    moved += 1;
    touched = true;
  }
  if (touched)
    writeFileSync(file, `${JSON.stringify(held, undefined, 2)}\n`, 'utf8');
}

const unknown = [...wanted.keys()].filter((id) => !seen.has(id));
if (unknown.length > 0) {
  console.error(
    `Familles inconnues de la nomenclature : ${unknown.join(', ')}`,
  );
  process.exit(1);
}
if (left.length > 0) {
  console.error(
    `Familles laissées en OTHER sans décision : ${left.join(', ')}`,
  );
  process.exit(1);
}
console.log(
  `${moved} familles rangées, ${Object.keys(ASSIGNED).length} catégories utilisées, ${STAYS.length} laissée(s) en OTHER.`,
);
