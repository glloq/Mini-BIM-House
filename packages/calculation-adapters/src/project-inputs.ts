import type { CalculationJson } from '@house-technical-designer/calculation-core';
import type { TechnicalNetwork } from '@house-technical-designer/core-domain';
import type {
  ProjectCalculationContext,
  ProjectClimateContext,
  ProjectSpaceCalculationElement,
} from './project-context.js';
import { equipmentNumber } from './project-context.js';
import type { MissingCalculationInput } from './calculation-settings.js';

/** Modules the project integration can feed from persisted facts. */
export const PROJECT_CALCULATION_MODULE_IDS = [
  'thermal',
  'heating',
  'dhw',
  'lighting',
  'ventilation',
  'iaq',
  'water',
  'wastewater',
  'rainwater',
  'photovoltaic',
  'battery',
  'energy-balance',
  'hygrothermal',
  'acoustics',
  'cost',
  'environmental',
] as const;

export type ProjectCalculationModuleId =
  (typeof PROJECT_CALCULATION_MODULE_IDS)[number];

export interface ProjectCalculationInputs {
  readonly inputs: Readonly<Record<string, CalculationJson>>;
  /** Inputs no project, scenario, module setting or dataset could provide. */
  readonly missing: readonly MissingCalculationInput[];
  readonly provenance: readonly {
    readonly moduleId: string;
    readonly key: string;
    readonly origin: string;
    readonly sourceId: string;
  }[];
}

const HOURS_PER_DAY = 24;

function daysInPeriod(period: string, resolution: string): number | undefined {
  if (resolution === 'HOURLY') return 1 / HOURS_PER_DAY;
  if (resolution === 'DAILY') return 1;
  if (resolution !== 'MONTHLY') return undefined;
  const match = /^(\d{4})-(\d{2})/.exec(period);
  if (match === null) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return undefined;
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Hours covered by each climate period, derived from the dataset resolution. */
function periodHours(
  climate: ProjectClimateContext | undefined,
): readonly number[] | undefined {
  if (climate === undefined) return undefined;
  const hours = climate.periods.map((period) => {
    const days = daysInPeriod(period, climate.resolution);
    return days === undefined ? undefined : days * HOURS_PER_DAY;
  });
  return hours.every((value): value is number => value !== undefined)
    ? hours
    : undefined;
}

function pathLengthM(
  path: readonly { x: number; y: number; z: number }[],
): number {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1]!;
    const current = path[index]!;
    total += Math.hypot(
      current.x - previous.x,
      current.y - previous.y,
      current.z - previous.z,
    );
  }
  return total / 1000;
}

function numericProperty(
  properties: Readonly<Record<string, unknown>> | undefined,
  key: string,
): number | undefined {
  const value = properties?.[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function stringProperty(
  properties: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | undefined {
  const value = properties?.[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function firstNetwork(
  context: ProjectCalculationContext,
  discipline: string,
): TechnicalNetwork | undefined {
  return context.networksByDiscipline[discipline]?.[0];
}

/**
 * Accumulates a per-terminal quantity along a network towards its source, so a
 * duct or pipe carries the demand of everything downstream of it.
 */
function edgeFlows(
  network: TechnicalNetwork,
  terminalFlow: (nodeId: string) => number | undefined,
): ReadonlyMap<string, number> {
  const portNode = new Map(network.ports.map((port) => [port.id, port.nodeId]));
  const downstream = new Map<string, string[]>();
  for (const edge of network.edges) {
    const from = portNode.get(edge.fromPortId);
    const to = portNode.get(edge.toPortId);
    if (from === undefined || to === undefined) continue;
    const bucket = downstream.get(from) ?? [];
    bucket.push(to);
    downstream.set(from, bucket);
  }
  const cache = new Map<string, number>();
  const collect = (nodeId: string, seen: ReadonlySet<string>): number => {
    const cached = cache.get(nodeId);
    if (cached !== undefined) return cached;
    if (seen.has(nodeId)) return 0;
    const nextSeen = new Set(seen).add(nodeId);
    const own = terminalFlow(nodeId) ?? 0;
    const total = (downstream.get(nodeId) ?? []).reduce(
      (sum, child) => sum + collect(child, nextSeen),
      own,
    );
    cache.set(nodeId, total);
    return total;
  };
  const flows = new Map<string, number>();
  for (const edge of network.edges) {
    const to = portNode.get(edge.toPortId);
    if (to === undefined) continue;
    flows.set(edge.id, collect(to, new Set()));
  }
  return flows;
}

function spaceOccupancy(
  context: ProjectCalculationContext,
  space: ProjectSpaceCalculationElement,
  moduleId: string,
): number | undefined {
  const byCategory = context.settings.optionalNumberRecord(
    moduleId,
    'occupantsByCategory',
  );
  const value = byCategory?.[space.category];
  return typeof value === 'number' ? value : undefined;
}

function thermalInput(context: ProjectCalculationContext): CalculationJson {
  const settings = context.settings;
  const insideSurfaceResistanceM2KW = settings.methodConstant(
    'thermal',
    'insideSurfaceResistanceM2KW',
  );
  const outsideSurfaceResistanceM2KW = settings.methodConstant(
    'thermal',
    'outsideSurfaceResistanceM2KW',
  );
  if (context.exteriorWalls.length === 0)
    settings.reportMissing(
      'thermal',
      'elements',
      'PROJECT',
      'The project has no exterior wall with a resolved assembly and explicit height.',
    );
  for (const wall of context.exteriorWalls) {
    settings.note('thermal', `elements/${wall.wallId}`, 'PROJECT', wall.wallId);
    for (const layer of wall.layers)
      if (layer.lambdaWmK === undefined)
        settings.reportMissing(
          'thermal',
          `elements/${wall.wallId}/layers/${layer.layerId}/lambdaWmK`,
          'PROJECT',
          `Material ${layer.materialId} declares no thermal conductivity.`,
        );
  }
  return {
    insideSurfaceResistanceM2KW,
    outsideSurfaceResistanceM2KW,
    elements: context.exteriorWalls.map((wall) => ({
      id: wall.wallId,
      areaM2: wall.netAreaM2,
      levelId: wall.levelId,
      assemblyId: wall.assemblyId,
      layers: wall.layers.map((layer) => ({ ...layer })),
    })),
  };
}

/** Ventilation design flow per space, read from the ventilation network terminals. */
function spaceVentilationFlowsM3h(
  context: ProjectCalculationContext,
): ReadonlyMap<string, number> {
  const network = firstNetwork(context, 'VENTILATION');
  const flows = new Map<string, number>();
  for (const node of network?.nodes ?? []) {
    const spaceId = node.spaceId;
    const flow = numericProperty(
      node as unknown as Readonly<Record<string, unknown>>,
      'targetFlowM3h',
    );
    if (spaceId === undefined || flow === undefined) continue;
    flows.set(spaceId, (flows.get(spaceId) ?? 0) + flow);
  }
  return flows;
}

function heatingInput(context: ProjectCalculationContext): CalculationJson {
  const settings = context.settings;
  const indoorC = settings.requiredNumber(
    'heating',
    'designIndoorTemperatureC',
    'Set the design indoor temperature in the heating module settings.',
  );
  let outdoorC = settings.optionalNumber(
    'heating',
    'designOutdoorTemperatureC',
  );
  if (
    outdoorC === undefined &&
    context.climate?.minimumAirTemperatureC !== undefined
  ) {
    outdoorC = context.climate.minimumAirTemperatureC;
    settings.note(
      'heating',
      'designOutdoorTemperatureC',
      'CLIMATE_DATASET',
      context.climate.datasetId,
    );
  }
  if (outdoorC === undefined)
    settings.reportMissing(
      'heating',
      'designOutdoorTemperatureC',
      'CLIMATE_DATASET',
      'No design outdoor temperature: provide a climate dataset or an explicit module setting.',
    );
  const ventilationFlows = spaceVentilationFlowsM3h(context);
  const recoveryEfficiency = settings.optionalNumber(
    'heating',
    'heatRecoveryEfficiency',
  );
  const rooms = context.spaces.map((space) => {
    const flowM3h = ventilationFlows.get(space.spaceId);
    if (flowM3h === undefined)
      settings.reportMissing(
        'heating',
        `rooms/${space.spaceId}/ventilationFlowM3h`,
        'PROJECT',
        `No ventilation terminal serves ${space.name}; its ventilation loss is unknown.`,
      );
    return {
      roomId: space.spaceId,
      ...(space.floorAreaM2 === undefined
        ? {}
        : { floorAreaM2: space.floorAreaM2 }),
      ...(flowM3h === undefined ? {} : { ventilationFlowM3h: flowM3h }),
    };
  });
  return {
    ...(indoorC === undefined ? {} : { designIndoorTemperatureC: indoorC }),
    ...(outdoorC === undefined ? {} : { designOutdoorTemperatureC: outdoorC }),
    ...(recoveryEfficiency === undefined
      ? {}
      : { heatRecoveryEfficiency: recoveryEfficiency }),
    airDensityKgM3: settings.physicalConstant('heating', 'airDensityKgM3'),
    airSpecificHeatJKgK: settings.physicalConstant(
      'heating',
      'airSpecificHeatJKgK',
    ),
    rooms,
  };
}

function lightingInput(context: ProjectCalculationContext): CalculationJson {
  const settings = context.settings;
  const electrical = firstNetwork(context, 'ELECTRICAL');
  const luminaireEquipment = context.equipmentByKind.LUMINAIRE ?? [];
  const luminaires = luminaireEquipment.map((equipment) => ({
    id: equipment.id,
    name: stringProperty(equipment.properties, 'name') ?? equipment.id,
    luminousFluxLm: equipmentNumber(
      context,
      equipment,
      'luminousFluxLm',
      'lighting',
    ),
    electricalPowerW: equipmentNumber(
      context,
      equipment,
      'electricalPowerW',
      'lighting',
    ),
    catalogKind: equipment.catalogKind,
  }));
  for (const luminaire of luminaires)
    if (
      luminaire.luminousFluxLm === undefined ||
      luminaire.electricalPowerW === undefined
    )
      settings.reportMissing(
        'lighting',
        `luminaires/${luminaire.id}`,
        'EQUIPMENT',
        `Luminaire ${luminaire.id} declares no luminous flux or electrical power.`,
      );
  const placements = (electrical?.nodes ?? [])
    .filter((node) => node.kind === 'LUMINAIRE')
    .map((node) => ({
      id: node.id,
      luminaireId: stringProperty(
        node as unknown as Readonly<Record<string, unknown>>,
        'catalogItemId',
      ),
      roomId: node.spaceId,
      position: { x: node.position.x, y: node.position.y },
    }));
  if (placements.length === 0)
    settings.reportMissing(
      'lighting',
      'placements',
      'PROJECT',
      'No luminaire node is placed on the electrical network.',
    );
  const utilizationFactor = settings.requiredNumber(
    'lighting',
    'utilizationFactor',
    'Set the lighting utilisation factor in the module settings.',
  );
  const maintenanceFactor = settings.requiredNumber(
    'lighting',
    'maintenanceFactor',
    'Set the lighting maintenance factor in the module settings.',
  );
  const operatingHoursByPeriod = settings.optionalNumber(
    'lighting',
    'operatingHoursPerDay',
  );
  return {
    ...(utilizationFactor === undefined ? {} : { utilizationFactor }),
    ...(maintenanceFactor === undefined ? {} : { maintenanceFactor }),
    ...(operatingHoursByPeriod === undefined
      ? {}
      : { operatingHoursPerDay: operatingHoursByPeriod }),
    rooms: context.spaces.map((space) => ({
      roomId: space.spaceId,
      name: space.name,
      ...(space.floorAreaM2 === undefined
        ? {}
        : { roomAreaM2: space.floorAreaM2 }),
    })),
    luminaires: luminaires.map((luminaire) => ({
      ...luminaire,
      luminousFluxLm: luminaire.luminousFluxLm ?? null,
      electricalPowerW: luminaire.electricalPowerW ?? null,
    })),
    placements: placements.map((placement) => ({
      ...placement,
      luminaireId: placement.luminaireId ?? null,
      roomId: placement.roomId ?? null,
    })),
  };
}

function ventilationInput(context: ProjectCalculationContext): CalculationJson {
  const settings = context.settings;
  const network = firstNetwork(context, 'VENTILATION');
  if (network === undefined) {
    settings.reportMissing(
      'ventilation',
      'network',
      'PROJECT',
      'The project has no ventilation network.',
    );
    return { segments: [] };
  }
  const roughnessM = settings.methodConstant('ventilation', 'ductRoughnessM');
  const nodeFlow = new Map(
    network.nodes.map((node) => [
      node.id,
      numericProperty(
        node as unknown as Readonly<Record<string, unknown>>,
        'targetFlowM3h',
      ) ?? 0,
    ]),
  );
  const flows = edgeFlows(network, (nodeId) => nodeFlow.get(nodeId));
  const segments = network.edges.map((edge) => {
    const diameterM = numericProperty(edge.properties, 'diameterM');
    const flowM3h = flows.get(edge.id);
    if (diameterM === undefined)
      settings.reportMissing(
        'ventilation',
        `segments/${edge.id}/diameterM`,
        'PROJECT',
        `Duct ${edge.id} has no internal diameter.`,
      );
    if (flowM3h === undefined || flowM3h <= 0)
      settings.reportMissing(
        'ventilation',
        `segments/${edge.id}/flowM3h`,
        'PROJECT',
        `Duct ${edge.id} serves no terminal with a design flow.`,
      );
    settings.note('ventilation', `segments/${edge.id}`, 'PROJECT', network.id);
    return {
      id: edge.id,
      lengthM: pathLengthM(edge.path),
      diameterM: diameterM ?? null,
      flowM3h: flowM3h ?? null,
      localLossCoefficient:
        numericProperty(edge.properties, 'localLossCoefficient') ?? 0,
      roughnessM: numericProperty(edge.properties, 'roughnessM') ?? roughnessM,
    };
  });
  return {
    networkId: network.id,
    airDensityKgM3: settings.physicalConstant('ventilation', 'airDensityKgM3'),
    dynamicViscosityPaS: settings.physicalConstant(
      'ventilation',
      'airDynamicViscosityPaS',
    ),
    segments,
    terminals: network.nodes
      .filter((node) => node.spaceId !== undefined)
      .map((node) => ({
        id: node.id,
        spaceId: node.spaceId ?? null,
        targetFlowM3h: nodeFlow.get(node.id) ?? null,
      })),
  };
}

function waterInput(context: ProjectCalculationContext): CalculationJson {
  const settings = context.settings;
  const network = firstNetwork(context, 'WATER');
  if (network === undefined) {
    settings.reportMissing(
      'water',
      'network',
      'PROJECT',
      'The project has no water network.',
    );
    return { segments: [] };
  }
  const roughnessM = settings.methodConstant('water', 'pipeRoughnessM');
  const simultaneity = settings.requiredNumber(
    'water',
    'simultaneityFactor',
    'Set the water simultaneity factor in the module settings.',
  );
  const nodeFlow = new Map(
    network.nodes.map((node) => [
      node.id,
      numericProperty(
        node as unknown as Readonly<Record<string, unknown>>,
        'designFlowLps',
      ) ?? 0,
    ]),
  );
  const flows = edgeFlows(network, (nodeId) => nodeFlow.get(nodeId));
  const segments = network.edges.map((edge) => {
    const diameterM = numericProperty(edge.properties, 'internalDiameterM');
    const cumulatedLps = flows.get(edge.id) ?? 0;
    if (diameterM === undefined)
      settings.reportMissing(
        'water',
        `segments/${edge.id}/internalDiameterM`,
        'PROJECT',
        `Pipe ${edge.id} has no internal diameter.`,
      );
    if (cumulatedLps <= 0)
      settings.reportMissing(
        'water',
        `segments/${edge.id}/flow`,
        'PROJECT',
        `Pipe ${edge.id} serves no fixture with a design flow.`,
      );
    return {
      id: edge.id,
      lengthM: pathLengthM(edge.path),
      internalDiameterM: diameterM ?? null,
      cumulatedDesignFlowLps: cumulatedLps,
      flowM3s:
        simultaneity === undefined
          ? null
          : (cumulatedLps * simultaneity) / 1000,
      localLossCoefficient:
        numericProperty(edge.properties, 'localLossCoefficient') ?? 0,
      roughnessM: numericProperty(edge.properties, 'roughnessM') ?? roughnessM,
    };
  });
  return {
    networkId: network.id,
    fluidDensityKgM3: settings.physicalConstant('water', 'waterDensityKgM3'),
    dynamicViscosityPaS: settings.physicalConstant(
      'water',
      'waterDynamicViscosityPaS',
    ),
    gravityMs2: settings.physicalConstant('water', 'gravityMs2'),
    ...(simultaneity === undefined ? {} : { simultaneityFactor: simultaneity }),
    segments,
  };
}

function wastewaterInput(context: ProjectCalculationContext): CalculationJson {
  const settings = context.settings;
  const network = firstNetwork(context, 'WASTEWATER');
  if (network === undefined) {
    settings.reportMissing(
      'wastewater',
      'network',
      'PROJECT',
      'The project has no wastewater network.',
    );
    return { segments: [] };
  }
  const flowPerUnit = settings.requiredNumber(
    'wastewater',
    'designFlowM3sPerDischargeUnit',
    'Set the discharge-unit to design-flow factor in the wastewater module settings.',
  );
  const minimumSlope = settings.optionalNumber('wastewater', 'minimumSlope');
  const nodes = network.nodes.map((node) => ({
    id: node.id,
    kind: node.kind,
    position: { ...node.position },
    dischargeUnits:
      numericProperty(
        node as unknown as Readonly<Record<string, unknown>>,
        'dischargeUnits',
      ) ?? null,
  }));
  const edges = network.edges.map((edge) => {
    const diameterM = numericProperty(edge.properties, 'internalDiameterM');
    if (diameterM === undefined)
      settings.reportMissing(
        'wastewater',
        `segments/${edge.id}/internalDiameterM`,
        'PROJECT',
        `Gravity pipe ${edge.id} has no internal diameter.`,
      );
    return {
      id: edge.id,
      fromPortId: edge.fromPortId,
      toPortId: edge.toPortId,
      kind: edge.kind,
      path: edge.path.map((point) => ({ ...point })),
      internalDiameterM: diameterM ?? null,
    };
  });
  return {
    networkId: network.id,
    systemType: network.systemType,
    ...(flowPerUnit === undefined
      ? {}
      : { designFlowM3sPerDischargeUnit: flowPerUnit }),
    ...(minimumSlope === undefined ? {} : { minimumSlope }),
    nodes,
    ports: network.ports.map((port) => ({
      id: port.id,
      nodeId: port.nodeId,
      role: port.role,
      direction: port.direction,
    })),
    edges,
  };
}

function rainwaterInput(context: ProjectCalculationContext): CalculationJson {
  const settings = context.settings;
  const climate = context.climate;
  if (climate === undefined)
    settings.reportMissing(
      'rainwater',
      'climate',
      'CLIMATE_DATASET',
      'Rainwater harvesting needs a precipitation dataset for the site.',
    );
  else
    settings.note(
      'rainwater',
      'precipitationMm',
      'CLIMATE_DATASET',
      climate.datasetId,
    );
  const tank = (context.equipmentByKind.RAINWATER_TANK ?? [])[0];
  const nominalVolumeL = equipmentNumber(
    context,
    tank,
    'nominalVolumeL',
    'rainwater',
  );
  if (nominalVolumeL === undefined)
    settings.reportMissing(
      'rainwater',
      'tank/nominalVolumeL',
      'EQUIPMENT',
      'No rainwater tank equipment declares a nominal volume.',
    );
  const runoffCoefficient = settings.requiredNumber(
    'rainwater',
    'runoffCoefficient',
    'Set the roof runoff coefficient in the rainwater module settings.',
  );
  const preFilterEfficiency = settings.requiredNumber(
    'rainwater',
    'preFilterEfficiency',
    'Set the pre-filter efficiency in the rainwater module settings.',
  );
  const dailyDemandL = settings.requiredNumber(
    'rainwater',
    'dailyDemandL',
    'Set the non-potable daily demand in the rainwater module settings.',
  );
  if (context.roofs.length === 0)
    settings.reportMissing(
      'rainwater',
      'surfaces',
      'PROJECT',
      'The project declares no roof plane to collect rain from.',
    );
  const hours = periodHours(climate);
  return {
    ...(climate === undefined
      ? {}
      : {
          climateDatasetId: climate.datasetId,
          periods: [...climate.periods],
          precipitationMm: climate.precipitationMm.map(
            (value) => value ?? null,
          ),
        }),
    ...(hours === undefined ? {} : { periodHours: [...hours] }),
    ...(dailyDemandL === undefined ? {} : { dailyDemandL }),
    ...(nominalVolumeL === undefined ? {} : { nominalVolumeL }),
    initialVolumeL:
      equipmentNumber(context, tank, 'initialVolumeL', 'rainwater') ?? 0,
    surfaces: context.roofs.map((roof) => ({
      surfaceId: roof.roofId,
      projectedAreaM2: roof.projectedAreaM2,
      runoffCoefficient: runoffCoefficient ?? null,
      preFilterEfficiency: preFilterEfficiency ?? null,
    })),
  };
}

function iaqInput(context: ProjectCalculationContext): CalculationJson {
  const settings = context.settings;
  const generationM3sPerOccupant = settings.requiredNumber(
    'iaq',
    'co2GenerationM3sPerOccupant',
    'Set the CO₂ generation rate per occupant in the IAQ module settings.',
  );
  const initialConcentrationPpm = settings.requiredNumber(
    'iaq',
    'initialConcentrationPpm',
    'Set the initial indoor CO₂ concentration in the IAQ module settings.',
  );
  const durationHours = settings.requiredNumber(
    'iaq',
    'durationHours',
    'Set the simulated duration in the IAQ module settings.',
  );
  const flows = spaceVentilationFlowsM3h(context);
  const rooms = context.spaces.map((space) => {
    const occupants = spaceOccupancy(context, space, 'iaq');
    if (occupants === undefined)
      settings.reportMissing(
        'iaq',
        `rooms/${space.spaceId}/occupants`,
        'MODULE_SETTINGS',
        `No occupancy is declared for category ${space.category}.`,
      );
    if (space.volumeM3 === undefined)
      settings.reportMissing(
        'iaq',
        `rooms/${space.spaceId}/volumeM3`,
        'PROJECT',
        `Space ${space.name} has no boundary or storey height to derive a volume from.`,
      );
    return {
      roomId: space.spaceId,
      name: space.name,
      volumeM3: space.volumeM3 ?? null,
      flowM3h: flows.get(space.spaceId) ?? null,
      occupants: occupants ?? null,
    };
  });
  return {
    ...(generationM3sPerOccupant === undefined
      ? {}
      : { co2GenerationM3sPerOccupant: generationM3sPerOccupant }),
    ...(initialConcentrationPpm === undefined
      ? {}
      : { initialConcentrationPpm }),
    ...(durationHours === undefined ? {} : { durationHours }),
    outdoorConcentrationPpm: settings.physicalConstant('iaq', 'outdoorCo2Ppm'),
    rooms,
  };
}

function photovoltaicInput(
  context: ProjectCalculationContext,
): CalculationJson {
  const settings = context.settings;
  const installedPowerWp = equipmentNumber(
    context,
    context.photovoltaic,
    'installedPowerWp',
    'photovoltaic',
  );
  if (installedPowerWp === undefined)
    settings.reportMissing(
      'photovoltaic',
      'installedPowerWp',
      'EQUIPMENT',
      'No photovoltaic equipment declares an installed peak power.',
    );
  const performanceRatio = settings.requiredNumber(
    'photovoltaic',
    'performanceRatio',
    'Set the photovoltaic performance ratio in the module settings.',
  );
  const climate = context.climate;
  if (climate === undefined)
    settings.reportMissing(
      'photovoltaic',
      'irradiation',
      'CLIMATE_DATASET',
      'Photovoltaic production needs an irradiation dataset for the site.',
    );
  else {
    settings.note(
      'photovoltaic',
      'irradiationWhM2',
      'CLIMATE_DATASET',
      climate.datasetId,
    );
    climate.globalHorizontalIrradianceWhM2.forEach((value, index) => {
      if (value === undefined)
        settings.reportMissing(
          'photovoltaic',
          `irradiation/${climate.periods[index]}`,
          'CLIMATE_DATASET',
          `Climate dataset ${climate.datasetId} has no irradiance for ${climate.periods[index]}.`,
        );
    });
  }
  const roof = context.roofs[0];
  const dispatchClimate = context.subDailyClimate;
  return {
    ...(installedPowerWp === undefined ? {} : { installedPowerWp }),
    ...(performanceRatio === undefined ? {} : { performanceRatio }),
    ...(dispatchClimate === undefined
      ? {}
      : {
          dispatchClimateDatasetId: dispatchClimate.datasetId,
          dispatchPeriods: [...dispatchClimate.periods],
          dispatchIrradiationWhM2:
            dispatchClimate.globalHorizontalIrradianceWhM2.map(
              (value) => value ?? null,
            ),
        }),
    ...(climate === undefined
      ? {}
      : {
          climateDatasetId: climate.datasetId,
          climateProvider: climate.provider,
          periods: [...climate.periods],
          irradiationWhM2: climate.globalHorizontalIrradianceWhM2.map(
            (value) => value ?? null,
          ),
        }),
    ...(roof === undefined
      ? {}
      : {
          roofId: roof.roofId,
          slopeDeg: roof.slopeDeg,
          azimuthDeg: roof.azimuthDeg,
          availableAreaM2: roof.surfaceAreaM2,
        }),
  };
}

function batteryInput(context: ProjectCalculationContext): CalculationJson {
  const settings = context.settings;
  const battery = context.battery;
  const read = (property: string): number | undefined => {
    const value = equipmentNumber(context, battery, property, 'battery');
    if (value === undefined)
      settings.reportMissing(
        'battery',
        property,
        'EQUIPMENT',
        `Battery equipment declares no ${property}.`,
      );
    return value;
  };
  const usableCapacityKWh = read('usableCapacityKWh');
  const minimumSoc = read('minimumSoc');
  const maximumSoc = read('maximumSoc');
  const initialSoc = read('initialSoc');
  const maxChargePowerKW = read('maxChargePowerKW');
  const maxDischargePowerKW = read('maxDischargePowerKW');
  const chargeEfficiency = read('chargeEfficiency');
  const dischargeEfficiency = read('dischargeEfficiency');
  const offGrid = settings.optionalNumber('battery', 'offGrid') === 1;
  const dispatchClimate = context.subDailyClimate;
  const hours = periodHours(dispatchClimate);
  if (hours === undefined)
    settings.reportMissing(
      'battery',
      'periodHours',
      'CLIMATE_DATASET',
      'Storage dispatch needs a uniform sub-daily climate dataset; monthly normals cannot resolve charge and discharge.',
    );
  else
    settings.note(
      'battery',
      'periodHours',
      'CLIMATE_DATASET',
      dispatchClimate!.datasetId,
    );
  return {
    ...(usableCapacityKWh === undefined ? {} : { usableCapacityKWh }),
    ...(minimumSoc === undefined ? {} : { minimumSoc }),
    ...(maximumSoc === undefined ? {} : { maximumSoc }),
    ...(initialSoc === undefined ? {} : { initialSoc }),
    ...(maxChargePowerKW === undefined ? {} : { maxChargePowerKW }),
    ...(maxDischargePowerKW === undefined ? {} : { maxDischargePowerKW }),
    ...(chargeEfficiency === undefined ? {} : { chargeEfficiency }),
    ...(dischargeEfficiency === undefined ? {} : { dischargeEfficiency }),
    ...(hours === undefined ? {} : { periodHours: [...hours] }),
    ...(dispatchClimate === undefined
      ? {}
      : {
          climateDatasetId: dispatchClimate.datasetId,
          periods: [...dispatchClimate.periods],
        }),
    offGrid,
  };
}

function energyBalanceInput(
  context: ProjectCalculationContext,
): CalculationJson {
  const settings = context.settings;
  const climate = context.subDailyClimate ?? context.climate;
  const hours = periodHours(climate);
  if (climate === undefined || hours === undefined)
    settings.reportMissing(
      'energy-balance',
      'periods',
      'CLIMATE_DATASET',
      'The energy ledger is built over the periods of a uniform climate dataset.',
    );
  else
    settings.note(
      'energy-balance',
      'outdoorTemperatureC',
      'CLIMATE_DATASET',
      climate.datasetId,
    );
  const setpointC = settings.optionalNumber(
    'energy-balance',
    'heatingSetpointTemperatureC',
  );
  const fanPowerW = (context.equipmentByKind.FAN ?? []).reduce<number>(
    (total, equipment) =>
      total +
      (equipmentNumber(context, equipment, 'nominalPowerW', 'energy-balance') ??
        0),
    0,
  );
  return {
    scenarioId: context.scenarioId ?? context.projectId,
    ...(climate === undefined
      ? {}
      : {
          climateDatasetId: climate.datasetId,
          resolution: climate.resolution,
          periods: [...climate.periods],
          outdoorTemperatureC: climate.airTemperatureC.map(
            (value) => value ?? null,
          ),
        }),
    ...(hours === undefined ? {} : { periodHours: [...hours] }),
    ...(setpointC === undefined
      ? {}
      : { heatingSetpointTemperatureC: setpointC }),
    ventilationFanPowerW: fanPowerW,
  };
}

function hygrothermalInput(
  context: ProjectCalculationContext,
): CalculationJson {
  const settings = context.settings;
  const indoorTemperatureC = settings.requiredNumber(
    'hygrothermal',
    'indoorTemperatureC',
    'Set the indoor design temperature in the hygrothermal module settings.',
  );
  const indoorRelativeHumidity = settings.requiredNumber(
    'hygrothermal',
    'indoorRelativeHumidity',
    'Set the indoor relative humidity in the hygrothermal module settings.',
  );
  const climate = context.climate;
  const outdoorTemperatureC =
    settings.optionalNumber('hygrothermal', 'outdoorTemperatureC') ??
    climate?.minimumAirTemperatureC;
  const outdoorRelativeHumidity =
    settings.optionalNumber('hygrothermal', 'outdoorRelativeHumidity') ??
    climate?.meanRelativeHumidity;
  if (outdoorTemperatureC === undefined)
    settings.reportMissing(
      'hygrothermal',
      'outdoorTemperatureC',
      'CLIMATE_DATASET',
      'No outdoor temperature is available for the condensation assessment.',
    );
  if (outdoorRelativeHumidity === undefined)
    settings.reportMissing(
      'hygrothermal',
      'outdoorRelativeHumidity',
      'CLIMATE_DATASET',
      'No outdoor relative humidity is available for the condensation assessment.',
    );
  const assemblies = context.exteriorWalls.map((wall) => {
    for (const layer of wall.layers)
      if (layer.mu === undefined)
        settings.reportMissing(
          'hygrothermal',
          `assemblies/${wall.assemblyId}/layers/${layer.layerId}/mu`,
          'PROJECT',
          `Material ${layer.materialId} declares no vapour resistance factor.`,
        );
    return {
      assemblyId: wall.assemblyId,
      elementId: wall.wallId,
      layers: wall.layers.map((layer) => ({
        id: layer.layerId,
        thicknessM: layer.thicknessM,
        lambdaWmK: layer.lambdaWmK ?? null,
        mu: layer.mu ?? null,
      })),
    };
  });
  return {
    ...(indoorTemperatureC === undefined ? {} : { indoorTemperatureC }),
    ...(indoorRelativeHumidity === undefined ? {} : { indoorRelativeHumidity }),
    ...(outdoorTemperatureC === undefined ? {} : { outdoorTemperatureC }),
    ...(outdoorRelativeHumidity === undefined
      ? {}
      : { outdoorRelativeHumidity }),
    interiorSurfaceResistanceM2KW: settings.methodConstant(
      'hygrothermal',
      'interiorSurfaceResistanceM2KW',
    ),
    exteriorSurfaceResistanceM2KW: settings.methodConstant(
      'hygrothermal',
      'exteriorSurfaceResistanceM2KW',
    ),
    period:
      settings.optionalString('hygrothermal', 'period') ?? 'design-winter',
    assemblies,
  };
}

function acousticsInput(context: ProjectCalculationContext): CalculationJson {
  const settings = context.settings;
  const bandList = settings.optionalNumberArray('acoustics', 'bandsHz');
  if (bandList === undefined || bandList.length === 0)
    settings.reportMissing(
      'acoustics',
      'bandsHz',
      'MODULE_SETTINGS',
      'Set the octave bands to assess in the acoustics module settings.',
    );
  const absorptionByMaterial = new Map(
    context.materials.map((material) => [
      material.id,
      material.properties.acousticAbsorption,
    ]),
  );
  const defaultAbsorption = settings.optionalNumberRecord(
    'acoustics',
    'defaultSurfaceAbsorption',
  );
  const rooms = context.spaces.map((space) => {
    if (space.volumeM3 === undefined)
      settings.reportMissing(
        'acoustics',
        `rooms/${space.spaceId}/volumeM3`,
        'PROJECT',
        `Space ${space.name} has no derivable volume.`,
      );
    const wallAreaM2 =
      space.perimeterM === undefined || space.heightM === undefined
        ? undefined
        : space.perimeterM * space.heightM;
    return {
      roomId: space.spaceId,
      name: space.name,
      volumeM3: space.volumeM3 ?? null,
      floorAreaM2: space.floorAreaM2 ?? null,
      wallAreaM2: wallAreaM2 ?? null,
    };
  });
  const absorption: Record<string, CalculationJson> = {};
  for (const [materialId, coefficients] of absorptionByMaterial)
    if (coefficients !== undefined)
      absorption[materialId] = { ...coefficients };
  return {
    reverberationConstant: settings.methodConstant(
      'acoustics',
      'reverberationConstant',
    ),
    ...(bandList === undefined ? {} : { bandsHz: bandList }),
    ...(defaultAbsorption === undefined
      ? {}
      : { defaultSurfaceAbsorption: { ...defaultAbsorption } }),
    materialAbsorption: absorption,
    rooms,
  };
}

function dhwInput(context: ProjectCalculationContext): CalculationJson {
  const settings = context.settings;
  const litresPerOccupant = settings.requiredNumber(
    'dhw',
    'dailyUseVolumeLPerOccupant',
    'Set the daily hot water volume per occupant in the DHW module settings.',
  );
  const occupants = settings.requiredNumber(
    'dhw',
    'householdOccupants',
    'Declare the household occupancy in the DHW module settings.',
  );
  const coldWaterTemperatureC = settings.requiredNumber(
    'dhw',
    'coldWaterTemperatureC',
    'Set the cold water inlet temperature in the DHW module settings.',
  );
  const useTemperatureC = settings.requiredNumber(
    'dhw',
    'useTemperatureC',
    'Set the hot water use temperature in the DHW module settings.',
  );
  const storageTemperatureC = settings.requiredNumber(
    'dhw',
    'storageTemperatureC',
    'Set the storage temperature in the DHW module settings.',
  );
  const annualOperatingDays = settings.requiredNumber(
    'dhw',
    'annualOperatingDays',
    'Set the number of operating days per year in the DHW module settings.',
  );
  const tank = (context.equipmentByKind.DHW_TANK ?? [])[0];
  const tankVolumeL = equipmentNumber(context, tank, 'tankVolumeL', 'dhw');
  const usefulHeatingPowerW = equipmentNumber(
    context,
    tank,
    'usefulHeatingPowerW',
    'dhw',
  );
  if (tankVolumeL === undefined || usefulHeatingPowerW === undefined)
    settings.reportMissing(
      'dhw',
      'tank',
      'EQUIPMENT',
      'No hot water tank equipment declares a volume and a useful heating power.',
    );
  return {
    ...(litresPerOccupant === undefined || occupants === undefined
      ? {}
      : { dailyUseVolumeL: litresPerOccupant * occupants }),
    ...(occupants === undefined ? {} : { occupants }),
    ...(coldWaterTemperatureC === undefined ? {} : { coldWaterTemperatureC }),
    ...(useTemperatureC === undefined ? {} : { useTemperatureC }),
    ...(storageTemperatureC === undefined ? {} : { storageTemperatureC }),
    ...(annualOperatingDays === undefined ? {} : { annualOperatingDays }),
    ...(tankVolumeL === undefined ? {} : { tankVolumeL }),
    ...(usefulHeatingPowerW === undefined ? {} : { usefulHeatingPowerW }),
    waterDensityKgM3: settings.physicalConstant('dhw', 'waterDensityKgM3'),
    waterSpecificHeatJKgK: settings.physicalConstant(
      'dhw',
      'waterSpecificHeatJKgK',
    ),
  };
}

function costInput(context: ProjectCalculationContext): CalculationJson {
  const settings = context.settings;
  const prices = settings.optionalNumberRecord('cost', 'unitPriceByMaterial');
  const currency = settings.optionalString('cost', 'currency') ?? 'EUR';
  const wasteFactors = settings.optionalNumberRecord(
    'cost',
    'wasteFactorByMaterial',
  );
  const labourPrices = settings.optionalNumberRecord(
    'cost',
    'labourPriceByMaterial',
  );
  if (prices === undefined)
    settings.reportMissing(
      'cost',
      'unitPriceByMaterial',
      'MODULE_SETTINGS',
      'Declare unit prices per material, per cubic metre of installed material, in the cost module settings.',
    );
  const lines = context.quantities.filter(
    (line) => line.quantityType === 'VOLUME' && line.materialId !== undefined,
  );
  for (const line of lines)
    if (prices?.[line.materialId!] === undefined)
      settings.reportMissing(
        'cost',
        `unitPriceByMaterial/${line.materialId}`,
        'MODULE_SETTINGS',
        `No unit price is declared for material ${line.materialId}.`,
      );
  return {
    currency,
    ...(wasteFactors === undefined
      ? {}
      : { wasteFactorByMaterial: { ...wasteFactors } }),
    ...(labourPrices === undefined
      ? {}
      : { labourPriceByMaterial: { ...labourPrices } }),
    labourDeclared: labourPrices !== undefined,
    ...(prices === undefined ? {} : { unitPriceByMaterial: { ...prices } }),
    quantities: lines.map((line) => ({
      itemId: line.itemId,
      sourceEntityId: line.sourceEntityId,
      materialId: line.materialId ?? null,
      value: line.value,
      unit: line.unit,
    })),
  };
}

function environmentalInput(
  context: ProjectCalculationContext,
): CalculationJson {
  const settings = context.settings;
  const impacts = settings.optionalNumberRecord(
    'environmental',
    'gwpPerUnitByMaterial',
  );
  const indicator =
    settings.optionalString('environmental', 'indicator') ?? 'GWP';
  const validAt = settings.optionalString('environmental', 'validAt');
  const declarationSource = settings.optionalString(
    'environmental',
    'declarationSource',
  );
  if (impacts === undefined)
    settings.reportMissing(
      'environmental',
      'gwpPerUnitByMaterial',
      'MODULE_SETTINGS',
      'Declare environmental impact factors per material, with their source.',
    );
  if (declarationSource === undefined)
    settings.reportMissing(
      'environmental',
      'declarationSource',
      'MODULE_SETTINGS',
      'Environmental factors must name the declaration they come from.',
    );
  const lines = context.quantities.filter(
    (line) => line.quantityType === 'VOLUME' && line.materialId !== undefined,
  );
  for (const line of lines)
    if (impacts?.[line.materialId!] === undefined)
      settings.reportMissing(
        'environmental',
        `gwpPerUnitByMaterial/${line.materialId}`,
        'MODULE_SETTINGS',
        `No environmental declaration covers material ${line.materialId}.`,
      );
  return {
    indicator,
    ...(validAt === undefined ? {} : { validAt }),
    ...(declarationSource === undefined ? {} : { declarationSource }),
    ...(impacts === undefined ? {} : { gwpPerUnitByMaterial: { ...impacts } }),
    quantities: lines.map((line) => ({
      itemId: line.itemId,
      sourceEntityId: line.sourceEntityId,
      materialId: line.materialId ?? null,
      value: line.value,
      unit: line.unit,
    })),
  };
}

/**
 * Builds orchestrator inputs entirely from the project, its scenario, its module
 * settings and the identified climate dataset.
 *
 * Nothing is invented: values that cannot be resolved are left out of the inputs
 * and listed in {@link ProjectCalculationInputs.missing}, so a module reports a
 * missing input instead of computing on a placeholder.
 */
export function buildProjectCalculationInputs(
  context: ProjectCalculationContext,
): ProjectCalculationInputs {
  const inputs: Record<string, CalculationJson> = {
    thermal: thermalInput(context),
    heating: heatingInput(context),
    dhw: dhwInput(context),
    lighting: lightingInput(context),
    ventilation: ventilationInput(context),
    iaq: iaqInput(context),
    water: waterInput(context),
    wastewater: wastewaterInput(context),
    rainwater: rainwaterInput(context),
    photovoltaic: photovoltaicInput(context),
    battery: batteryInput(context),
    'energy-balance': energyBalanceInput(context),
    hygrothermal: hygrothermalInput(context),
    acoustics: acousticsInput(context),
    cost: costInput(context),
    environmental: environmentalInput(context),
  };
  return {
    inputs,
    missing: context.settings.missing,
    provenance: context.settings.provenance,
  };
}
