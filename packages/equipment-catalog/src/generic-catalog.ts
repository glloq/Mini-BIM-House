import type {
  EquipmentDefinition,
  EquipmentPropertySource,
  EquipmentPropertyValue,
} from './types.js';

/**
 * Reference for every value in the generic catalogue.
 *
 * These are indicative sizes and performances for early design. They are not
 * manufacturer data, and a definition that needs to represent a real product
 * must be created as `PRODUCT` with its own declaration.
 */
export const GENERIC_EQUIPMENT_REFERENCE =
  'Generic design values for preliminary sizing — not manufacturer data';

function sources(
  properties: Readonly<Record<string, EquipmentPropertyValue>>,
): readonly EquipmentPropertySource[] {
  return Object.keys(properties).map((property) => ({
    property,
    sourceType: 'STANDARD' as const,
    reference: GENERIC_EQUIPMENT_REFERENCE,
  }));
}

type DefinitionSeed = Omit<
  EquipmentDefinition,
  'sources' | 'catalogKind' | 'version'
>;

function generic(seed: DefinitionSeed): EquipmentDefinition {
  return {
    ...seed,
    catalogKind: 'GENERIC',
    version: '1.0.0',
    sources: sources(seed.properties),
  };
}

const port = (
  id: string,
  discipline: string,
  role: string,
  position: { x: number; y: number; z: number },
  extra: { connectionType?: string; nominalSize?: number } = {},
) => ({ id, discipline, role, position, ...extra });

const SEEDS: readonly DefinitionSeed[] = [
  {
    id: 'generic-circulator-pump',
    kind: 'PUMP',
    category: 'PUMP',
    name: 'Circulateur de chauffage',
    dimensions: { widthMm: 180, depthMm: 130, heightMm: 180 },
    ports: [
      port(
        'in',
        'HEATING',
        'RETURN',
        { x: -90, y: 0, z: 0 },
        { nominalSize: 0.026 },
      ),
      port(
        'out',
        'HEATING',
        'FLOW',
        { x: 90, y: 0, z: 0 },
        { nominalSize: 0.026 },
      ),
    ],
    properties: {
      nominalPowerW: 45,
      maximumHeadM: 6,
      maximumFlowM3h: 3.5,
      supplyVoltageV: 230,
    },
    performanceCurves: [
      {
        id: 'head-vs-flow',
        inputAxes: [{ id: 'flowM3h', unit: 'm3/h' }],
        output: 'headM',
        outputUnit: 'm',
        interpolation: 'LINEAR',
        points: [
          { inputs: [0], output: 6 },
          { inputs: [1], output: 5.2 },
          { inputs: [2], output: 3.9 },
          { inputs: [3], output: 2 },
          { inputs: [3.5], output: 0 },
        ],
      },
    ],
    rendering: {
      symbols: [{ discipline: 'HEATING', symbolId: 'symbol-pump' }],
      planFootprint: 'SYMBOL_ONLY',
      layer: 'heating.equipment',
    },
  },
  {
    id: 'generic-extract-ventilation-unit',
    kind: 'VENTILATION_UNIT',
    category: 'VENTILATION_UNIT',
    name: 'VMC simple flux hygroréglable',
    dimensions: { widthMm: 480, depthMm: 480, heightMm: 300 },
    ports: [
      port(
        'extract',
        'VENTILATION',
        'EXTRACT',
        { x: -240, y: 0, z: 0 },
        { nominalSize: 0.125 },
      ),
      port(
        'exhaust',
        'VENTILATION',
        'EXHAUST',
        { x: 240, y: 0, z: 0 },
        { nominalSize: 0.125 },
      ),
    ],
    properties: {
      designFlowM3h: 150,
      nominalPowerW: 22,
      maximumStaticPressurePa: 150,
      systemType: 'EXTRACT',
    },
    performanceCurves: [
      {
        id: 'pressure-vs-flow',
        inputAxes: [{ id: 'flowM3h', unit: 'm3/h' }],
        output: 'staticPressurePa',
        outputUnit: 'Pa',
        interpolation: 'LINEAR',
        points: [
          { inputs: [0], output: 150 },
          { inputs: [100], output: 120 },
          { inputs: [200], output: 70 },
          { inputs: [300], output: 0 },
        ],
      },
    ],
    rendering: {
      symbols: [
        { discipline: 'VENTILATION', symbolId: 'symbol-ventilation-unit' },
      ],
      planFootprint: 'RECTANGLE',
      layer: 'ventilation.equipment',
    },
  },
  {
    id: 'generic-balanced-ventilation-unit',
    kind: 'VENTILATION_UNIT',
    category: 'VENTILATION_UNIT',
    name: 'VMC double flux avec échangeur',
    dimensions: { widthMm: 600, depthMm: 600, heightMm: 500 },
    ports: [
      port(
        'extract',
        'VENTILATION',
        'EXTRACT',
        { x: -300, y: -150, z: 0 },
        { nominalSize: 0.16 },
      ),
      port(
        'exhaust',
        'VENTILATION',
        'EXHAUST',
        { x: 300, y: -150, z: 0 },
        { nominalSize: 0.16 },
      ),
      port(
        'intake',
        'VENTILATION',
        'INTAKE',
        { x: 300, y: 150, z: 0 },
        { nominalSize: 0.16 },
      ),
      port(
        'supply',
        'VENTILATION',
        'SUPPLY',
        { x: -300, y: 150, z: 0 },
        { nominalSize: 0.16 },
      ),
    ],
    properties: {
      designFlowM3h: 250,
      nominalPowerW: 55,
      heatRecoveryEfficiency: 0.85,
      maximumStaticPressurePa: 200,
      systemType: 'BALANCED',
      bypassAvailable: true,
    },
    rendering: {
      symbols: [
        { discipline: 'VENTILATION', symbolId: 'symbol-ventilation-unit' },
      ],
      planFootprint: 'RECTANGLE',
      layer: 'ventilation.equipment',
    },
  },
  {
    id: 'generic-air-terminal',
    kind: 'AIR_TERMINAL',
    category: 'AIR_TERMINAL',
    name: 'Bouche d’extraction',
    dimensions: { widthMm: 125, depthMm: 125, heightMm: 60 },
    ports: [
      port(
        'duct',
        'VENTILATION',
        'EXTRACT',
        { x: 0, y: 0, z: -30 },
        { nominalSize: 0.08 },
      ),
    ],
    properties: { targetFlowM3h: 30, pressureDropPa: 60, airRole: 'EXTRACT' },
    rendering: {
      symbols: [{ discipline: 'VENTILATION', symbolId: 'symbol-air-terminal' }],
      planFootprint: 'CIRCLE',
      layer: 'ventilation.terminals',
    },
  },
  {
    id: 'generic-radiator',
    kind: 'RADIATOR',
    category: 'RADIATOR',
    name: 'Radiateur eau chaude',
    dimensions: { widthMm: 1000, depthMm: 100, heightMm: 600 },
    ports: [
      port(
        'flow',
        'HEATING',
        'FLOW',
        { x: -480, y: 0, z: -280 },
        { nominalSize: 0.015 },
      ),
      port(
        'return',
        'HEATING',
        'RETURN',
        { x: 480, y: 0, z: -280 },
        { nominalSize: 0.015 },
      ),
    ],
    properties: {
      nominalOutputW: 1200,
      nominalFlowTemperatureC: 55,
      nominalReturnTemperatureC: 45,
      nominalRoomTemperatureC: 20,
      exponent: 1.3,
    },
    rendering: {
      symbols: [{ discipline: 'HEATING', symbolId: 'symbol-radiator' }],
      planFootprint: 'RECTANGLE',
      layer: 'heating.emitters',
    },
  },
  {
    id: 'generic-air-water-heat-pump',
    kind: 'HEAT_PUMP',
    category: 'HEAT_PUMP',
    name: 'Pompe à chaleur air/eau',
    dimensions: { widthMm: 1100, depthMm: 450, heightMm: 800 },
    ports: [
      port(
        'flow',
        'HEATING',
        'FLOW',
        { x: -400, y: 0, z: -350 },
        { nominalSize: 0.026 },
      ),
      port(
        'return',
        'HEATING',
        'RETURN',
        { x: 400, y: 0, z: -350 },
        { nominalSize: 0.026 },
      ),
      port('power', 'ELECTRICAL', 'SUPPLY', { x: 0, y: 200, z: -350 }),
    ],
    properties: {
      nominalHeatingCapacityW: 8000,
      nominalCop: 4.2,
      minimumOutdoorTemperatureC: -20,
      maximumFlowTemperatureC: 60,
      supplyVoltageV: 230,
    },
    performanceCurves: [
      {
        id: 'cop-vs-outdoor-temperature',
        inputAxes: [{ id: 'outdoorTemperatureC', unit: '°C' }],
        output: 'cop',
        outputUnit: '-',
        interpolation: 'LINEAR',
        points: [
          { inputs: [-15], output: 2 },
          { inputs: [-7], output: 2.6 },
          { inputs: [2], output: 3.4 },
          { inputs: [7], output: 4.2 },
          { inputs: [15], output: 5 },
        ],
      },
    ],
    rendering: {
      symbols: [{ discipline: 'HEATING', symbolId: 'symbol-heat-pump' }],
      planFootprint: 'RECTANGLE',
      layer: 'heating.generation',
    },
  },
  {
    id: 'generic-dhw-tank',
    kind: 'DHW_TANK',
    category: 'DHW_TANK',
    name: 'Ballon d’eau chaude sanitaire',
    dimensions: { widthMm: 570, depthMm: 570, heightMm: 1500 },
    ports: [
      port(
        'cold',
        'WATER',
        'COLD_INLET',
        { x: 0, y: 0, z: -740 },
        { nominalSize: 0.02 },
      ),
      port(
        'hot',
        'WATER',
        'HOT_OUTLET',
        { x: 0, y: 0, z: 740 },
        { nominalSize: 0.02 },
      ),
      port('power', 'ELECTRICAL', 'SUPPLY', { x: 280, y: 0, z: 0 }),
    ],
    properties: {
      tankVolumeL: 200,
      usefulHeatingPowerW: 2000,
      standbyLossW: 45,
      storageTemperatureC: 60,
    },
    rendering: {
      symbols: [{ discipline: 'WATER', symbolId: 'symbol-dhw-tank' }],
      planFootprint: 'CIRCLE',
      layer: 'water.equipment',
    },
  },
  {
    id: 'generic-pv-module',
    kind: 'PHOTOVOLTAIC',
    category: 'PV_MODULE',
    name: 'Module photovoltaïque',
    dimensions: { widthMm: 1134, depthMm: 35, heightMm: 1722 },
    ports: [port('dc', 'ELECTRICAL', 'DC', { x: 0, y: 0, z: -861 })],
    properties: {
      peakPowerWp: 400,
      moduleAreaM2: 1.95,
      moduleEfficiency: 0.205,
      temperatureCoefficientPerK: -0.0035,
      nominalVoltageV: 41,
    },
    rendering: {
      symbols: [{ discipline: 'ELECTRICAL', symbolId: 'symbol-pv-module' }],
      planFootprint: 'RECTANGLE',
      layer: 'solar.modules',
    },
  },
  {
    id: 'generic-inverter',
    kind: 'INVERTER',
    category: 'INVERTER',
    name: 'Onduleur photovoltaïque',
    dimensions: { widthMm: 400, depthMm: 180, heightMm: 550 },
    ports: [
      port('dc', 'ELECTRICAL', 'DC', { x: 0, y: 0, z: -275 }),
      port('ac', 'ELECTRICAL', 'AC', { x: 0, y: 0, z: 275 }),
    ],
    properties: {
      nominalAcPowerW: 5000,
      maximumDcPowerW: 7500,
      europeanEfficiency: 0.97,
      mpptInputCount: 2,
    },
    rendering: {
      symbols: [{ discipline: 'ELECTRICAL', symbolId: 'symbol-inverter' }],
      planFootprint: 'RECTANGLE',
      layer: 'electrical.equipment',
    },
  },
  {
    id: 'generic-battery',
    kind: 'BATTERY',
    category: 'BATTERY',
    name: 'Batterie de stockage lithium',
    dimensions: { widthMm: 600, depthMm: 200, heightMm: 900 },
    ports: [port('dc', 'ELECTRICAL', 'DC', { x: 0, y: 0, z: -450 })],
    properties: {
      usableCapacityKWh: 5,
      minimumSoc: 0.1,
      maximumSoc: 0.95,
      initialSoc: 0.5,
      maxChargePowerKW: 2.5,
      maxDischargePowerKW: 2.5,
      chargeEfficiency: 0.95,
      dischargeEfficiency: 0.95,
    },
    rendering: {
      symbols: [{ discipline: 'ELECTRICAL', symbolId: 'symbol-battery' }],
      planFootprint: 'RECTANGLE',
      layer: 'electrical.equipment',
    },
  },
  {
    id: 'generic-led-luminaire',
    kind: 'LUMINAIRE',
    category: 'LUMINAIRE',
    name: 'Plafonnier LED',
    dimensions: { widthMm: 300, depthMm: 300, heightMm: 60 },
    ports: [port('power', 'ELECTRICAL', 'SUPPLY', { x: 0, y: 0, z: 30 })],
    properties: {
      luminousFluxLm: 1400,
      electricalPowerW: 12,
      colorTemperatureK: 3000,
      cri: 80,
      powerFactor: 0.9,
    },
    rendering: {
      symbols: [{ discipline: 'ELECTRICAL', symbolId: 'symbol-luminaire' }],
      planFootprint: 'CIRCLE',
      layer: 'electrical.lighting',
    },
  },
  {
    id: 'generic-socket',
    kind: 'SOCKET',
    category: 'SOCKET',
    name: 'Prise de courant 16 A',
    dimensions: { widthMm: 80, depthMm: 40, heightMm: 80 },
    ports: [port('power', 'ELECTRICAL', 'SUPPLY', { x: 0, y: -20, z: 0 })],
    properties: { ratedCurrentA: 16, nominalVoltageV: 230, poleCount: 2 },
    rendering: {
      symbols: [{ discipline: 'ELECTRICAL', symbolId: 'symbol-socket' }],
      planFootprint: 'SYMBOL_ONLY',
      layer: 'electrical.outlets',
    },
  },
  {
    id: 'generic-distribution-board',
    kind: 'DISTRIBUTION_BOARD',
    category: 'DISTRIBUTION_BOARD',
    name: 'Tableau de répartition',
    dimensions: { widthMm: 350, depthMm: 100, heightMm: 450 },
    ports: [
      port('incoming', 'ELECTRICAL', 'INCOMING', { x: 0, y: 0, z: 225 }),
      port('outgoing', 'ELECTRICAL', 'OUTGOING', { x: 0, y: 0, z: -225 }),
    ],
    properties: { nominalVoltageV: 230, rowCount: 3, moduleCapacity: 39 },
    rendering: {
      symbols: [
        { discipline: 'ELECTRICAL', symbolId: 'symbol-distribution-board' },
      ],
      planFootprint: 'RECTANGLE',
      layer: 'electrical.distribution',
    },
  },
  {
    id: 'generic-miniature-circuit-breaker',
    kind: 'PROTECTION_DEVICE',
    category: 'PROTECTION_DEVICE',
    name: 'Disjoncteur divisionnaire',
    dimensions: { widthMm: 18, depthMm: 70, heightMm: 85 },
    ports: [
      port('line', 'ELECTRICAL', 'INCOMING', { x: 0, y: 0, z: 42 }),
      port('load', 'ELECTRICAL', 'OUTGOING', { x: 0, y: 0, z: -42 }),
    ],
    properties: { ratedCurrentA: 16, curve: 'C', breakingCapacityKA: 4.5 },
    rendering: {
      symbols: [
        { discipline: 'ELECTRICAL', symbolId: 'symbol-circuit-breaker' },
      ],
      planFootprint: 'SYMBOL_ONLY',
      layer: 'electrical.distribution',
    },
  },
  {
    id: 'generic-washbasin',
    kind: 'SANITARY_FIXTURE',
    category: 'SANITARY_FIXTURE',
    name: 'Lavabo',
    dimensions: { widthMm: 600, depthMm: 450, heightMm: 850 },
    ports: [
      port(
        'cold',
        'WATER',
        'COLD',
        { x: -100, y: 0, z: -300 },
        { nominalSize: 0.012 },
      ),
      port(
        'hot',
        'WATER',
        'HOT',
        { x: 100, y: 0, z: -300 },
        { nominalSize: 0.012 },
      ),
      port(
        'drain',
        'WASTEWATER',
        'DRAIN',
        { x: 0, y: 0, z: -400 },
        { nominalSize: 0.032 },
      ),
    ],
    properties: {
      designFlowLps: 0.2,
      hotWaterFraction: 0.5,
      dischargeUnits: 1,
      minimumPressurePa: 100_000,
    },
    rendering: {
      symbols: [{ discipline: 'WATER', symbolId: 'symbol-washbasin' }],
      planFootprint: 'RECTANGLE',
      layer: 'water.fixtures',
    },
  },
  {
    id: 'generic-shower',
    kind: 'SANITARY_FIXTURE',
    category: 'SANITARY_FIXTURE',
    name: 'Douche',
    dimensions: { widthMm: 900, depthMm: 900, heightMm: 2000 },
    ports: [
      port(
        'cold',
        'WATER',
        'COLD',
        { x: -100, y: 0, z: 200 },
        { nominalSize: 0.012 },
      ),
      port(
        'hot',
        'WATER',
        'HOT',
        { x: 100, y: 0, z: 200 },
        { nominalSize: 0.012 },
      ),
      port(
        'drain',
        'WASTEWATER',
        'DRAIN',
        { x: 0, y: 0, z: -1000 },
        { nominalSize: 0.04 },
      ),
    ],
    properties: {
      designFlowLps: 0.2,
      hotWaterFraction: 0.6,
      dischargeUnits: 2,
      minimumPressurePa: 100_000,
    },
    rendering: {
      symbols: [{ discipline: 'WATER', symbolId: 'symbol-shower' }],
      planFootprint: 'RECTANGLE',
      layer: 'water.fixtures',
    },
  },
  {
    id: 'generic-wc',
    kind: 'SANITARY_FIXTURE',
    category: 'SANITARY_FIXTURE',
    name: 'WC à réservoir',
    dimensions: { widthMm: 380, depthMm: 700, heightMm: 800 },
    ports: [
      port(
        'cold',
        'WATER',
        'COLD',
        { x: 0, y: 300, z: -300 },
        { nominalSize: 0.012 },
      ),
      port(
        'drain',
        'WASTEWATER',
        'DRAIN',
        { x: 0, y: 250, z: -350 },
        { nominalSize: 0.1 },
      ),
    ],
    properties: {
      designFlowLps: 0.12,
      hotWaterFraction: 0,
      dischargeUnits: 4,
      flushVolumeL: 6,
    },
    rendering: {
      symbols: [{ discipline: 'WATER', symbolId: 'symbol-wc' }],
      planFootprint: 'RECTANGLE',
      layer: 'water.fixtures',
    },
  },
  {
    id: 'generic-kitchen-sink',
    kind: 'SANITARY_FIXTURE',
    category: 'SANITARY_FIXTURE',
    name: 'Évier de cuisine',
    dimensions: { widthMm: 800, depthMm: 600, heightMm: 900 },
    ports: [
      port(
        'cold',
        'WATER',
        'COLD',
        { x: -100, y: 0, z: -300 },
        { nominalSize: 0.012 },
      ),
      port(
        'hot',
        'WATER',
        'HOT',
        { x: 100, y: 0, z: -300 },
        { nominalSize: 0.012 },
      ),
      port(
        'drain',
        'WASTEWATER',
        'DRAIN',
        { x: 0, y: 0, z: -450 },
        { nominalSize: 0.04 },
      ),
    ],
    properties: {
      designFlowLps: 0.2,
      hotWaterFraction: 0.5,
      dischargeUnits: 1,
      minimumPressurePa: 100_000,
    },
    rendering: {
      symbols: [{ discipline: 'WATER', symbolId: 'symbol-kitchen-sink' }],
      planFootprint: 'RECTANGLE',
      layer: 'water.fixtures',
    },
  },
  {
    id: 'generic-rainwater-tank',
    kind: 'RAINWATER_TANK',
    category: 'RAINWATER_TANK',
    name: 'Cuve de récupération d’eau de pluie',
    dimensions: { widthMm: 2000, depthMm: 1500, heightMm: 1800 },
    ports: [
      port(
        'inlet',
        'RAINWATER',
        'INLET',
        { x: 0, y: 0, z: 800 },
        { nominalSize: 0.1 },
      ),
      port(
        'overflow',
        'RAINWATER',
        'OVERFLOW',
        { x: 900, y: 0, z: 700 },
        { nominalSize: 0.1 },
      ),
      port(
        'outlet',
        'RAINWATER',
        'OUTLET',
        { x: 0, y: 0, z: -800 },
        { nominalSize: 0.032 },
      ),
    ],
    properties: { nominalVolumeL: 5000, initialVolumeL: 0, buried: true },
    rendering: {
      symbols: [{ discipline: 'RAINWATER', symbolId: 'symbol-rainwater-tank' }],
      planFootprint: 'RECTANGLE',
      layer: 'rainwater.equipment',
    },
  },
];

/** Builds the generic equipment catalogue shipped with the application. */
export function genericEquipmentCatalog(): readonly EquipmentDefinition[] {
  return SEEDS.map((seed) => generic(seed));
}

/** Looks a generic definition up by identifier. */
export function genericEquipment(id: string): EquipmentDefinition | undefined {
  return genericEquipmentCatalog().find((definition) => definition.id === id);
}
