import type { CalculationJson } from '@house-technical-designer/calculation-core';
import type {
  NetworkNode,
  TechnicalNetwork,
} from '@house-technical-designer/core-domain';
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
  'electrical',
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

/**
 * A value a node states about itself.
 *
 * Properties belong in the node's `properties` record. Files written before
 * that record existed carried them as fields of the node itself, and they are
 * still read there: an older project must keep calculating what it always did.
 */
function nodeNumber(node: NetworkNode, key: string): number | undefined {
  const declared = numericProperty(node.properties, key);
  if (declared !== undefined) return declared;
  return numericProperty(
    node as unknown as Readonly<Record<string, unknown>>,
    key,
  );
}

function nodeString(node: NetworkNode, key: string): string | undefined {
  const declared = stringProperty(node.properties, key);
  if (declared !== undefined) return declared;
  return stringProperty(
    node as unknown as Readonly<Record<string, unknown>>,
    key,
  );
}

/**
 * Every network of a discipline, in project order.
 *
 * A house can hold two water systems, two ventilation units or two boards, and
 * a module that read only the first one produced a result that looked complete
 * while ignoring half the installation. Each network contributes exactly once.
 */
/**
 * The singular pressure losses of a segment, or the hypothesis that it has none.
 *
 * A pipe with nothing stated is not necessarily a pipe without a bend. Taking
 * it as having none is defensible for a first sizing, but it is a choice, and
 * the choice is written into the assumptions of the result rather than left
 * inside the number.
 */
function localLosses(
  settings: ProjectCalculationContext['settings'],
  moduleId: 'water' | 'ventilation',
  edgeId: string,
  properties: Readonly<Record<string, unknown>> | undefined,
): number {
  const declared = numericProperty(properties, 'localLossCoefficient');
  if (declared !== undefined) return declared;
  settings.assume(
    moduleId,
    `segments/${edgeId}/localLossCoefficient`,
    0,
    'Aucune perte singulière déclarée sur ce tronçon : il est calculé sans raccord.',
  );
  return 0;
}

function networksForDiscipline(
  context: ProjectCalculationContext,
  discipline: string,
): readonly TechnicalNetwork[] {
  return context.networksByDiscipline[discipline] ?? [];
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
  const flows = new Map<string, number>();
  for (const network of networksForDiscipline(context, 'VENTILATION'))
    for (const node of network.nodes) {
      const spaceId = node.spaceId;
      const flow = nodeNumber(node, 'targetFlowM3h');
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
  const electrical = networksForDiscipline(context, 'ELECTRICAL');
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
  const placements = electrical
    .flatMap((network) => network.nodes)
    .filter((node) => node.kind === 'LUMINAIRE')
    .map((node) => ({
      id: node.id,
      // The binding is a field of the node; the catalogue reference in its
      // property record is what files written before that field carried.
      luminaireId: node.equipmentId ?? nodeString(node, 'catalogItemId'),
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
  const networks = networksForDiscipline(context, 'VENTILATION');
  if (networks.length === 0) {
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
    networks.flatMap((network) =>
      network.nodes.map((node): readonly [string, number] => [
        node.id,
        nodeNumber(node, 'targetFlowM3h') ?? 0,
      ]),
    ),
  );
  // Flows accumulate inside each system: a duct never carries the demand of a
  // terminal served by another unit.
  const flows = new Map(
    networks.flatMap((network) => [
      ...edgeFlows(network, (nodeId) => nodeFlow.get(nodeId)),
    ]),
  );
  const segments = networks.flatMap((network) =>
    network.edges.map((edge) => {
      const shape =
        stringProperty(edge.properties, 'shape') === 'RECTANGULAR'
          ? 'RECTANGULAR'
          : 'ROUND';
      const diameterM = numericProperty(edge.properties, 'diameterM');
      const widthM = numericProperty(edge.properties, 'widthM');
      const heightM = numericProperty(edge.properties, 'heightM');
      const flowM3h = flows.get(edge.id);
      // A rectangular duct is sized by its two sides; asking it for a diameter
      // would report a value it can never have.
      if (shape === 'ROUND' && diameterM === undefined)
        settings.reportMissing(
          'ventilation',
          `segments/${edge.id}/diameterM`,
          'PROJECT',
          `Duct ${edge.id} has no internal diameter.`,
        );
      if (
        shape === 'RECTANGULAR' &&
        (widthM === undefined || heightM === undefined)
      )
        settings.reportMissing(
          'ventilation',
          `segments/${edge.id}/${widthM === undefined ? 'widthM' : 'heightM'}`,
          'PROJECT',
          `Rectangular duct ${edge.id} states no width and height.`,
        );
      if (flowM3h === undefined || flowM3h <= 0)
        settings.reportMissing(
          'ventilation',
          `segments/${edge.id}/flowM3h`,
          'PROJECT',
          `Duct ${edge.id} serves no terminal with a design flow.`,
        );
      settings.note(
        'ventilation',
        `segments/${edge.id}`,
        'PROJECT',
        network.id,
      );
      return {
        id: edge.id,
        networkId: network.id,
        lengthM: pathLengthM(edge.path),
        shape,
        diameterM: diameterM ?? null,
        widthM: widthM ?? null,
        heightM: heightM ?? null,
        flowM3h: flowM3h ?? null,
        localLossCoefficient: localLosses(
          settings,
          'ventilation',
          edge.id,
          edge.properties,
        ),
        roughnessM:
          numericProperty(edge.properties, 'roughnessM') ?? roughnessM,
      };
    }),
  );
  return {
    networkIds: networks.map(({ id }) => id),
    airDensityKgM3: settings.physicalConstant('ventilation', 'airDensityKgM3'),
    dynamicViscosityPaS: settings.physicalConstant(
      'ventilation',
      'airDynamicViscosityPaS',
    ),
    segments,
    terminals: networks.flatMap((network) =>
      network.nodes
        .filter((node) => node.spaceId !== undefined)
        .map((node) => ({
          id: node.id,
          networkId: network.id,
          spaceId: node.spaceId ?? null,
          targetFlowM3h: nodeFlow.get(node.id) ?? null,
        })),
    ),
  };
}

function waterInput(context: ProjectCalculationContext): CalculationJson {
  const settings = context.settings;
  const networks = networksForDiscipline(context, 'WATER');
  if (networks.length === 0) {
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
    networks.flatMap((network) =>
      network.nodes.map((node): readonly [string, number] => [
        node.id,
        nodeNumber(node, 'designFlowLps') ?? 0,
      ]),
    ),
  );
  // Each system accumulates its own demand: a house pipe never carries the
  // garage's fixtures.
  const flows = new Map(
    networks.flatMap((network) => [
      ...edgeFlows(network, (nodeId) => nodeFlow.get(nodeId)),
    ]),
  );
  const segments = networks.flatMap((network) =>
    network.edges.map((edge) => {
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
      settings.note('water', `segments/${edge.id}`, 'PROJECT', network.id);
      return {
        id: edge.id,
        networkId: network.id,
        lengthM: pathLengthM(edge.path),
        internalDiameterM: diameterM ?? null,
        cumulatedDesignFlowLps: cumulatedLps,
        flowM3s:
          simultaneity === undefined
            ? null
            : (cumulatedLps * simultaneity) / 1000,
        localLossCoefficient: localLosses(
          settings,
          'water',
          edge.id,
          edge.properties,
        ),
        roughnessM:
          numericProperty(edge.properties, 'roughnessM') ?? roughnessM,
      };
    }),
  );
  return {
    networkIds: networks.map(({ id }) => id),
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
  const networks = networksForDiscipline(context, 'WASTEWATER');
  if (networks.length === 0) {
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
  // Systems are assessed together but stay separate graphs: each one drains to
  // its own outlet, and every node is checked against the outlet it can reach.
  const nodes = networks.flatMap((network) =>
    network.nodes.map((node) => ({
      id: node.id,
      networkId: network.id,
      kind: node.kind,
      position: { ...node.position },
      dischargeUnits: nodeNumber(node, 'dischargeUnits') ?? null,
    })),
  );
  const edges = networks.flatMap((network) =>
    network.edges.map((edge) => {
      const diameterM = numericProperty(edge.properties, 'internalDiameterM');
      if (diameterM === undefined)
        settings.reportMissing(
          'wastewater',
          `segments/${edge.id}/internalDiameterM`,
          'PROJECT',
          `Gravity pipe ${edge.id} has no internal diameter.`,
        );
      settings.note('wastewater', `segments/${edge.id}`, 'PROJECT', network.id);
      return {
        id: edge.id,
        networkId: network.id,
        fromPortId: edge.fromPortId,
        toPortId: edge.toPortId,
        kind: edge.kind,
        path: edge.path.map((point) => ({ ...point })),
        internalDiameterM: diameterM ?? null,
      };
    }),
  );
  return {
    networkIds: networks.map(({ id }) => id),
    systemTypes: networks.map(({ systemType }) => systemType),
    ...(flowPerUnit === undefined
      ? {}
      : { designFlowM3sPerDischargeUnit: flowPerUnit }),
    ...(minimumSlope === undefined ? {} : { minimumSlope }),
    nodes,
    ports: networks.flatMap((network) =>
      network.ports.map((port) => ({
        id: port.id,
        networkId: network.id,
        nodeId: port.nodeId,
        role: port.role,
        direction: port.direction,
      })),
    ),
    edges,
  };
}

/**
 * The single item of a kind, or nothing when the project holds several.
 *
 * Taking the first of two tanks would answer a question the project has not
 * decided. The ambiguity is reported instead, naming the candidates, so the
 * user picks rather than discovers later which one was used.
 */
function theOnly<T extends { readonly id: string }>(
  items: readonly T[],
  settings: ProjectCalculationContext['settings'],
  moduleId: string,
  key: string,
  what: string,
): T | undefined {
  if (items.length <= 1) return items[0];
  settings.reportMissing(
    moduleId,
    key,
    'EQUIPMENT',
    `The project declares ${items.length} ${what} (${items
      .map(({ id }) => id)
      .join(', ')}); state which one this module applies to.`,
  );
  return undefined;
}

/**
 * How many phases a node declares, when it declares one.
 *
 * The value may be stored as a number or as the text a menu produced; anything
 * else is not a phase count, and the circuit is reported as unstated rather
 * than assumed single-phase.
 */
function phaseCount(node: NetworkNode): 1 | 3 | undefined {
  const declared =
    nodeNumber(node, 'phases') ?? Number(nodeString(node, 'phases'));
  return declared === 1 || declared === 3 ? declared : undefined;
}

/** Node kinds that consume power, in the electrical templates the editor offers. */
const ELECTRICAL_LOAD_KINDS = new Set([
  'LUMINAIRE',
  'OUTLET',
  'FIXED_LOAD',
  'EV',
]);

/** Which node each port belongs to, so an edge can be read as node → node. */
function portOwners(network: TechnicalNetwork): ReadonlyMap<string, string> {
  return new Map(network.ports.map((port) => [port.id, port.nodeId]));
}

/**
 * Everything reachable from a node by following the segments forward.
 *
 * A circuit is what hangs below it: the lamps it feeds and the cables that
 * reach them. Walking the graph is what tells them apart, rather than a naming
 * convention nobody enforces.
 */
function downstream(
  network: TechnicalNetwork,
  fromNodeId: string,
): {
  readonly nodeIds: readonly string[];
  readonly edges: readonly TechnicalNetwork['edges'][number][];
} {
  const owners = portOwners(network);
  const visited = new Set([fromNodeId]);
  const edges: TechnicalNetwork['edges'][number][] = [];
  let frontier = [fromNodeId];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const edge of network.edges) {
      const from = owners.get(edge.fromPortId);
      const to = owners.get(edge.toPortId);
      if (from === undefined || to === undefined) continue;
      if (!frontier.includes(from) || visited.has(to)) continue;
      visited.add(to);
      edges.push(edge);
      next.push(to);
    }
    frontier = next;
  }
  visited.delete(fromNodeId);
  return { nodeIds: [...visited], edges };
}

function feedingEdge(
  network: TechnicalNetwork,
  nodeId: string,
): TechnicalNetwork['edges'][number] | undefined {
  const owners = portOwners(network);
  return network.edges.find((edge) => owners.get(edge.toPortId) === nodeId);
}

function upstreamNode(
  network: TechnicalNetwork,
  nodeId: string,
): NetworkNode | undefined {
  const owners = portOwners(network);
  const edge = feedingEdge(network, nodeId);
  if (edge === undefined) return undefined;
  const from = owners.get(edge.fromPortId);
  return network.nodes.find((node) => node.id === from);
}

/**
 * Circuits, loads and cables the project declares, read from its boards.
 *
 * Nothing is assumed: a circuit with no stated voltage, a lamp with no stated
 * power and a cable with no stated section are all reported as missing inputs
 * rather than completed with a habit.
 */
function electricalInput(context: ProjectCalculationContext): CalculationJson {
  const settings = context.settings;
  const networks = networksForDiscipline(context, 'ELECTRICAL');
  if (networks.length === 0) {
    settings.reportMissing(
      'electrical',
      'network',
      'PROJECT',
      'The project has no electrical network.',
    );
    return { circuits: [] };
  }
  const circuits: Record<string, CalculationJson>[] = [];
  const loads: Record<string, CalculationJson>[] = [];
  const cables: Record<string, CalculationJson>[] = [];
  for (const network of networks) {
    for (const circuitNode of network.nodes.filter(
      ({ kind }) => kind === 'CIRCUIT',
    )) {
      const board = upstreamNode(network, circuitNode.id);
      const reach = downstream(network, circuitNode.id);
      const feeder = feedingEdge(network, circuitNode.id);
      const voltageV =
        nodeNumber(circuitNode, 'nominalVoltageV') ??
        (board === undefined
          ? undefined
          : nodeNumber(board, 'nominalVoltageV'));
      if (voltageV === undefined)
        settings.reportMissing(
          'electrical',
          `circuits/${circuitNode.id}/nominalVoltageV`,
          'PROJECT',
          `Circuit ${circuitNode.id} states no nominal voltage.`,
        );
      const phases =
        phaseCount(circuitNode) ??
        (board === undefined ? undefined : phaseCount(board));
      if (phases !== 1 && phases !== 3)
        settings.reportMissing(
          'electrical',
          `circuits/${circuitNode.id}/phases`,
          'PROJECT',
          `Circuit ${circuitNode.id} states no single- or three-phase configuration.`,
        );
      const loadNodes = network.nodes.filter(
        (node) =>
          reach.nodeIds.includes(node.id) &&
          (ELECTRICAL_LOAD_KINDS.has(node.kind) ||
            nodeNumber(node, 'activePowerW') !== undefined),
      );
      if (loadNodes.length === 0)
        settings.reportMissing(
          'electrical',
          `circuits/${circuitNode.id}/loads`,
          'PROJECT',
          `Circuit ${circuitNode.id} reaches no load.`,
        );
      for (const node of loadNodes) {
        const equipment = context.equipment.find(
          ({ id }) =>
            id === node.equipmentId || id === nodeString(node, 'catalogItemId'),
        );
        const activePowerW =
          nodeNumber(node, 'activePowerW') ??
          (equipment === undefined
            ? undefined
            : equipmentNumber(
                context,
                equipment,
                'electricalPowerW',
                'electrical',
              ));
        if (activePowerW === undefined)
          settings.reportMissing(
            'electrical',
            `loads/${node.id}/activePowerW`,
            equipment === undefined ? 'PROJECT' : 'EQUIPMENT',
            `Load ${node.id} states no active power.`,
          );
        const powerFactor = nodeNumber(node, 'powerFactor');
        if (powerFactor === undefined)
          settings.reportMissing(
            'electrical',
            `loads/${node.id}/powerFactor`,
            'PROJECT',
            `Load ${node.id} states no power factor.`,
          );
        const demandFactor = nodeNumber(node, 'demandFactor');
        if (demandFactor === undefined)
          settings.reportMissing(
            'electrical',
            `loads/${node.id}/demandFactor`,
            'PROJECT',
            `Load ${node.id} states no demand factor.`,
          );
        loads.push({
          loadId: node.id,
          circuitId: circuitNode.id,
          name: nodeString(node, 'name') ?? node.id,
          activePowerW: activePowerW ?? null,
          powerFactor: powerFactor ?? null,
          demandFactor: demandFactor ?? null,
        });
      }
      // The feeder carries the whole circuit, so it belongs to its cable path;
      // the branch runs follow it. A circuit that branches is reported as such
      // by the module rather than totalled as if it were one run.
      const circuitCables = [
        ...(feeder === undefined ? [] : [feeder]),
        ...reach.edges,
      ];
      for (const edge of circuitCables) {
        const sectionMm2 =
          numericProperty(edge.properties, 'conductorSectionMm2') ??
          nodeNumber(circuitNode, 'conductorSectionMm2');
        if (sectionMm2 === undefined)
          settings.reportMissing(
            'electrical',
            `cables/${edge.id}/conductorSectionMm2`,
            'PROJECT',
            `Cable ${edge.id} states no conductor section.`,
          );
        settings.note('electrical', `cables/${edge.id}`, 'PROJECT', network.id);
        // The material sets the resistance and therefore the voltage drop.
        // Copper is the common case, which is exactly why assuming it would go
        // unnoticed: an unstated material is reported, not chosen.
        const material = stringProperty(edge.properties, 'conductorMaterial');
        if (material === undefined)
          settings.reportMissing(
            'electrical',
            `cables/${edge.id}/conductorMaterial`,
            'PROJECT',
            `Cable ${edge.id} states no conductor material.`,
          );
        cables.push({
          id: edge.id,
          circuitId: circuitNode.id,
          networkId: network.id,
          path: edge.path.map((point) => ({ ...point })),
          conductorSectionMm2: sectionMm2 ?? null,
          conductorMaterial: material ?? null,
          conductorCount:
            numericProperty(edge.properties, 'conductorCount') ?? null,
        });
      }
      circuits.push({
        id: circuitNode.id,
        networkId: network.id,
        boardId: board?.id ?? null,
        purpose: nodeString(circuitNode, 'purpose') ?? 'POWER',
        voltageV: voltageV ?? null,
        phases: phases === 1 || phases === 3 ? phases : null,
        voltageReference: phases === 3 ? 'PHASE_PHASE' : 'PHASE_NEUTRAL',
        loadIds: loadNodes.map(({ id }) => id),
      });
    }
  }
  if (circuits.length === 0)
    settings.reportMissing(
      'electrical',
      'circuits',
      'PROJECT',
      'No electrical network declares a circuit node.',
    );
  return {
    networkIds: networks.map(({ id }) => id),
    copperResistivityOhmMm2PerM: settings.methodConstant(
      'electrical',
      'copperResistivityOhmMm2PerM',
    ),
    aluminiumResistivityOhmMm2PerM: settings.methodConstant(
      'electrical',
      'aluminiumResistivityOhmMm2PerM',
    ),
    circuits,
    loads,
    cables,
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
  const tank = theOnly(
    context.equipmentByKind.RAINWATER_TANK ?? [],
    settings,
    'rainwater',
    'tank',
    'rainwater tanks',
  );
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
  // A photovoltaic array sits on one plane; with several roofs the project has
  // not said which, and guessing would fix a slope and an orientation nobody
  // chose.
  const roof =
    context.roofs.length <= 1
      ? context.roofs[0]
      : theOnly(
          context.roofs.map((entry) => ({ ...entry, id: entry.roofId })),
          settings,
          'photovoltaic',
          'roof',
          'roof planes',
        );
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
  // Written as a boolean since the setting became a checkbox; a project file
  // from before that still holds 1 or 0, and both mean the same thing.
  const offGrid =
    settings.optionalBoolean('battery', 'offGrid') ??
    settings.optionalNumber('battery', 'offGrid') === 1;
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
  const tank = theOnly(
    context.equipmentByKind.DHW_TANK ?? [],
    settings,
    'dhw',
    'tank',
    'hot water tanks',
  );
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
    electrical: electricalInput(context),
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
