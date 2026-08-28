import type { CalculationJson } from '@house-technical-designer/calculation-core';
import {
  describeUnknown,
  known,
  resolvedNumber,
  sumResolved,
  unknown,
  valueOf,
  type ResolvedNumber,
} from '@house-technical-designer/calculation-core';
import type {
  EquipmentDefinition,
  JsonValue,
  NetworkEdge,
  NetworkNode,
  TechnicalNetwork,
} from '@house-technical-designer/core-domain';
import {
  networkProduct,
  resolvedSegmentProperties,
} from '@house-technical-designer/network-products';
import { UNNAMED_RUN } from '@house-technical-designer/quantities';
import type {
  ProjectCalculationContext,
  ProjectClimateContext,
  ProjectQuantityLine,
  ProjectSpaceCalculationElement,
} from './project-context.js';
import { equipmentNumber } from './project-context.js';
import { equipmentKindOf } from '@house-technical-designer/core-domain';
import type { MissingCalculationInput } from './calculation-settings.js';
import type { ProjectCalculationModuleId } from './module-registry.js';
import { PROJECT_CALCULATION_MODULE_IDS } from './module-registry.js';

// Kept reachable from here so that every consumer of the module list can go on
// importing it from where it always was.
export {
  PROJECT_CALCULATION_MODULE_IDS,
  type ProjectCalculationModuleId,
} from './module-registry.js';

/**
 * What each module needs the project to say.
 *
 * `satisfies` is the point: the compiler refuses this map if it misses one of
 * the seventeen identifiers, so the set of modules is stated once — in
 * `module-registry` — and everything else is checked against it rather than
 * repeated beside it.
 */
const MODULE_INPUT_BUILDERS = {
  thermal: thermalInput,
  heating: heatingInput,
  dhw: dhwInput,
  lighting: lightingInput,
  electrical: electricalInput,
  ventilation: ventilationInput,
  iaq: iaqInput,
  water: waterInput,
  wastewater: wastewaterInput,
  rainwater: rainwaterInput,
  photovoltaic: photovoltaicInput,
  battery: batteryInput,
  'energy-balance': energyBalanceInput,
  hygrothermal: hygrothermalInput,
  acoustics: acousticsInput,
  cost: costInput,
  environmental: environmentalInput,
} satisfies Record<
  ProjectCalculationModuleId,
  (context: ProjectCalculationContext) => CalculationJson
>;

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

/**
 * What a run is made of, the product first and the segment having the last
 * word.
 *
 * Everything reading a segment's physical properties goes through this, so
 * that naming a product and typing its figures onto the run are the same
 * thing said once instead of two things that can disagree.
 */
function segmentProperties(
  context: ProjectCalculationContext,
  edge: NetworkEdge,
): Readonly<Record<string, JsonValue>> {
  return resolvedSegmentProperties(
    edge.productId,
    edge.properties,
    context.networkProducts,
  ) as Readonly<Record<string, JsonValue>>;
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
 *
 * A terminal that states no flow makes the whole run unknown rather than
 * contributing zero. A pipe fed by a shower at 0,15 L/s and a basin nobody
 * described used to come out at 0,15 L/s — the total, unmarked, and wrong.
 * What comes out now is « au moins 0,15 L/s, et voici le nœud qui manque ».
 */
function edgeFlows(
  network: TechnicalNetwork,
  terminalFlow: (nodeId: string) => number | undefined,
): ReadonlyMap<string, ResolvedNumber> {
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
  const cache = new Map<string, ResolvedNumber>();
  const collect = (
    nodeId: string,
    seen: ReadonlySet<string>,
  ): ResolvedNumber => {
    const cached = cache.get(nodeId);
    if (cached !== undefined) return cached;
    // A loop contributes nothing rather than contributing forever; it is a
    // fact about the drawing, not about the flow, and the network validation
    // is what reports it.
    if (seen.has(nodeId)) return known(0);
    const nextSeen = new Set(seen).add(nodeId);
    const children = downstream.get(nodeId) ?? [];
    const stated = terminalFlow(nodeId);
    /*
     * A junction states no flow of its own, and that is not an unknown: it
     * carries what is under it. A leaf that states no flow is the unknown —
     * it is the thing that was supposed to consume something, and nobody said
     * how much.
     *
     * Read from the shape of the run rather than from a list of node kinds:
     * a list would treat tomorrow's kind of terminal as a junction, silently.
     */
    const own =
      stated !== undefined
        ? known(stated)
        : children.length > 0
          ? known(0)
          : unknown([nodeId]);
    const total = sumResolved([
      own,
      ...children.map((child) => collect(child, nextSeen)),
    ]);
    cache.set(nodeId, total);
    return total;
  };
  const flows = new Map<string, ResolvedNumber>();
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

/**
 * The transmittance a bought element states, out of the catalogue entry it is.
 *
 * A window is not assembled from layers: its datasheet gives one Uw covering
 * the glass, the frame and the spacer, and no stack of layers reproduces it.
 */
function declaredUValue(
  context: ProjectCalculationContext,
  definitionId: string | undefined,
): number | undefined {
  if (definitionId === undefined) return undefined;
  // The opening catalogue first, because that is where a window's model now
  // lives; the equipment library second, for the files written while it was
  // the only place a window could be filed.
  const definition =
    context.openingTypes.find(({ id }) => id === definitionId) ??
    context.equipment.find(({ id }) => id === definitionId);
  for (const key of ['uw', 'uValueWm2K', 'thermalTransmittanceWm2K']) {
    const value = definition?.properties?.[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0)
      return value;
  }
  return undefined;
}

const ENVELOPE_LABELS: Readonly<Record<string, string>> = {
  WALL_OPAQUE: 'le mur',
  WINDOW: 'la fenêtre',
  DOOR: 'la porte',
  ROOF: 'le pan de toiture',
  FLOOR_GROUND: 'le plancher bas',
  CEILING: 'le plafond',
  OTHER: "l'élément",
};

/**
 * The whole envelope, given to the engine element by element.
 *
 * It used to be the exterior walls and nothing else. A window was taken out of
 * its wall and never put back as a window — twenty square metres of wall with
 * four of glass reached the calculation as sixteen square metres of masonry
 * and four square metres of nothing. The roof was resolved in the context and
 * never reached the envelope; neither did the floors.
 */
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
  const assemblies = new Map(
    context.assemblies.map((assembly) => [assembly.id as string, assembly]),
  );
  const materials = new Map(
    context.materials.map((material) => [material.id as string, material]),
  );
  const elements: CalculationJson[] = [];

  for (const element of context.envelope) {
    const what = `${ENVELOPE_LABELS[element.kind] ?? "l'élément"} ${element.sourceEntityId}`;
    if (element.netAreaM2 === undefined) {
      settings.reportMissing(
        'thermal',
        `elements/${element.sourceEntityId}/areaM2`,
        'PROJECT',
        element.unresolved ?? `La surface de ${what} est inconnue.`,
      );
      continue;
    }
    settings.note(
      'thermal',
      `elements/${element.sourceEntityId}`,
      'PROJECT',
      element.sourceEntityId,
    );
    const shared = {
      id: element.sourceEntityId,
      areaM2: element.netAreaM2,
      levelId: element.levelId,
      kind: element.kind,
      boundaryCondition: element.boundaryCondition,
    };
    // Built of layers, or bought whole. Those are the two ways an element of
    // the envelope knows its transmittance, and neither is guessed.
    if (element.assemblyId !== undefined) {
      const assembly = assemblies.get(element.assemblyId);
      if (assembly === undefined) {
        settings.reportMissing(
          'thermal',
          `elements/${element.sourceEntityId}/assemblyId`,
          'PROJECT',
          `${what} nomme la composition ${element.assemblyId}, que le projet ne tient pas.`,
        );
        continue;
      }
      const layers = assembly.layers.map((layer) => {
        const lambdaWmK = materials.get(layer.materialId)?.properties
          ?.lambdaWmK;
        if (typeof lambdaWmK !== 'number')
          settings.reportMissing(
            'thermal',
            `elements/${element.sourceEntityId}/layers/${layer.id}/lambdaWmK`,
            'PROJECT',
            `Material ${layer.materialId} declares no thermal conductivity.`,
          );
        return {
          layerId: layer.id,
          materialId: layer.materialId,
          thicknessM: layer.thicknessM,
          ...(typeof lambdaWmK === 'number' ? { lambdaWmK } : {}),
        };
      });
      elements.push({ ...shared, assemblyId: assembly.id, layers });
      continue;
    }
    const uValueWm2K = declaredUValue(context, element.definitionId);
    if (uValueWm2K === undefined) {
      settings.reportMissing(
        'thermal',
        `elements/${element.sourceEntityId}/uValueWm2K`,
        'PROJECT',
        element.definitionId === undefined
          ? `${what} ne dit pas de quel modèle elle est : sa transmission reste inconnue.`
          : `Le modèle ${element.definitionId} ne déclare pas de coefficient Uw.`,
      );
      continue;
    }
    elements.push({ ...shared, uValueWm2K, layers: [] });
  }

  if (elements.length === 0)
    settings.reportMissing(
      'thermal',
      'elements',
      'PROJECT',
      "Le projet ne décrit aucune paroi d'enveloppe dont la surface et la composition soient connues.",
    );
  return {
    insideSurfaceResistanceM2KW,
    outsideSurfaceResistanceM2KW,
    elements,
  };
}

/** Ventilation design flow per space, read from the ventilation network terminals. */
function spaceVentilationFlowsM3h(
  context: ProjectCalculationContext,
): ReadonlyMap<string, ResolvedNumber> {
  // A room served by two terminals, one of which states no flow, has an
  // unknown flow — not the flow of the other one. Skipping the silent terminal
  // would hand the heating engine a room that breathes half as much as it
  // does, with nothing on screen to say so.
  const perSpace = new Map<string, ResolvedNumber[]>();
  for (const network of networksForDiscipline(context, 'VENTILATION'))
    for (const node of network.nodes) {
      const spaceId = node.spaceId;
      if (spaceId === undefined) continue;
      const bucket = perSpace.get(spaceId) ?? [];
      bucket.push(resolvedNumber(nodeNumber(node, 'targetFlowM3h'), node.id));
      perSpace.set(spaceId, bucket);
    }
  return new Map(
    [...perSpace].map(([spaceId, flows]) => [spaceId, sumResolved(flows)]),
  );
}

function heatingInput(context: ProjectCalculationContext): CalculationJson {
  const settings = context.settings;
  const indoorC = settings.requiredNumber(
    'heating',
    'designIndoorTemperatureC',
    'Donnez la température intérieure de base dans les réglages du chauffage.',
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
      'Aucune température extérieure de base : chargez un jeu de données climatiques, ou donnez-la dans les réglages du chauffage.',
    );
  const ventilationFlows = spaceVentilationFlowsM3h(context);
  const recoveryEfficiency = settings.optionalNumber(
    'heating',
    'heatRecoveryEfficiency',
  );
  /*
   * The additional design load a room carries beyond its envelope and its air.
   *
   * The engine is right to ask: it is a real design input — a heated towel
   * rail, an allowance for a large glazed loggia, a room that has to come up
   * to temperature fast. Nothing in the model states it, and the adapter used
   * to answer « supposons 0 W » on every room without saying so.
   *
   * Zero is a defensible answer and it stays the answer; what changes is that
   * it is now written down, travels with the result, and can be replaced by a
   * figure the person actually chose.
   */
  const declaredOtherW = settings.optionalNumber(
    'heating',
    'additionalRoomLoadW',
  );
  const otherW = declaredOtherW ?? 0;
  if (declaredOtherW === undefined)
    settings.assume(
      'heating',
      'additionalRoomLoadW',
      0,
      'Aucune charge additionnelle déclarée pour les pièces',
    );
  /*
   * Which parts of the envelope belong to which room.
   *
   * The room load used to be the building's transmission shared out by floor
   * area — an honest fallback, recorded as one, that could not tell a room
   * with three façades from a room with one. It stays as the fallback for a
   * room whose walls do not enclose it, and the note below says which rooms
   * fell back.
   */
  const attribution = new Map(
    context.roomEnvelopes.map((room) => [room.spaceId, room]),
  );
  for (const room of attribution.values())
    if (room.unresolved !== undefined)
      settings.note(
        'heating',
        `rooms/${room.spaceId}/envelope`,
        'PROJECT',
        room.unresolved,
      );
  const rooms = context.spaces.map((space) => {
    const resolved = ventilationFlows.get(space.spaceId);
    const flowM3h = resolved === undefined ? undefined : valueOf(resolved);
    if (resolved === undefined)
      settings.reportMissing(
        'heating',
        `rooms/${space.spaceId}/ventilationFlowM3h`,
        'PROJECT',
        `No ventilation terminal serves ${space.name}; its ventilation loss is unknown.`,
      );
    else if (resolved.status === 'UNKNOWN')
      settings.reportMissing(
        'heating',
        `rooms/${space.spaceId}/ventilationFlowM3h`,
        'PROJECT',
        `${space.name} : ${describeUnknown(resolved)}`,
      );
    if (space.floorAreaM2 === undefined)
      settings.reportMissing(
        'heating',
        `rooms/${space.spaceId}/floorAreaM2`,
        'PROJECT',
        space.unresolvedGeometry ??
          `Space ${space.name} has no derivable floor area.`,
      );
    return {
      roomId: space.spaceId,
      ...(space.floorAreaM2 === undefined
        ? {}
        : { floorAreaM2: space.floorAreaM2 }),
      ...(flowM3h === undefined ? {} : { ventilationFlowM3h: flowM3h }),
      otherW,
      // What this room actually loses heat through. Its walls and their
      // openings are its own; the roof and the floor are shared by area.
      envelopeElementIds: [
        ...(attribution.get(space.spaceId)?.elementIds ?? []),
      ],
      horizontalShare: attribution.get(space.spaceId)?.horizontalShare ?? 0,
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
  const nodePlacements = electrical
    .flatMap((network) => network.nodes)
    .filter((node) => node.kind === 'LUMINAIRE')
    .map((node) => ({
      id: node.id,
      // The binding is a field of the node; the catalogue reference in its
      // property record is what files written before that field carried.
      luminaireId: node.equipmentId ?? nodeString(node, 'catalogItemId'),
      roomId: node.spaceId,
      position: { x: node.position.x, y: node.position.y },
      componentId: node.componentId,
    }));
  // A luminaire drawn on the plan lights the room whether or not anybody has
  // routed a circuit to it. The lighting calculation used to see the network
  // alone, so the building had to be drawn twice for it to count.
  const claimed = new Set(
    nodePlacements.flatMap(({ componentId }) =>
      componentId === undefined ? [] : [componentId],
    ),
  );
  const componentPlacements = context.placedEquipment
    .filter(
      (placed) =>
        placed.category === 'LIGHTING' &&
        // A model that is known has to be a luminaire; one that is not stays a
        // placement without a model, which the module reports rather than
        // guesses at.
        (placed.kind === undefined || placed.kind === 'LUMINAIRE') &&
        !claimed.has(placed.instanceId),
    )
    .map((placed) => ({
      id: placed.instanceId,
      luminaireId: placed.definitionId,
      roomId: placed.spaceId,
      position: { x: placed.position.x, y: placed.position.y },
      componentId: placed.instanceId,
    }));
  const placements = [...nodePlacements, ...componentPlacements];
  if (placements.length === 0)
    settings.reportMissing(
      'lighting',
      'placements',
      'PROJECT',
      'Aucun luminaire n’est posé sur le réseau électrique.',
    );
  const utilizationFactor = settings.requiredNumber(
    'lighting',
    'utilizationFactor',
    'Donnez le facteur d’utilance dans les réglages de l’éclairage.',
  );
  const maintenanceFactor = settings.requiredNumber(
    'lighting',
    'maintenanceFactor',
    'Donnez le facteur de maintenance dans les réglages de l’éclairage.',
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
    rooms: context.spaces.map((space) => {
      // A room the project cannot measure is not a room of nought square
      // metres: the lumen method has nothing to divide by, and saying so is
      // what keeps an illuminance from being reported for a room whose size
      // nobody knows.
      if (space.floorAreaM2 === undefined)
        settings.reportMissing(
          'lighting',
          `rooms/${space.spaceId}/roomAreaM2`,
          'PROJECT',
          space.unresolvedGeometry ??
            `Space ${space.name} has no derivable floor area.`,
        );
      return {
        roomId: space.spaceId,
        name: space.name,
        ...(space.floorAreaM2 === undefined
          ? {}
          : { roomAreaM2: space.floorAreaM2 }),
      };
    }),
    luminaires: luminaires.map((luminaire) => ({
      ...luminaire,
      luminousFluxLm: luminaire.luminousFluxLm ?? null,
      electricalPowerW: luminaire.electricalPowerW ?? null,
    })),
    placements: placements.map(({ componentId: _placed, ...placement }) => ({
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
      'Le projet n’a aucun réseau de ventilation.',
    );
    return { segments: [] };
  }
  const roughnessM = settings.methodConstant('ventilation', 'ductRoughnessM');
  const nodeFlow = new Map(
    networks.flatMap((network) =>
      network.nodes.map((node): readonly [string, number | undefined] => [
        node.id,
        nodeNumber(node, 'targetFlowM3h'),
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
        stringProperty(segmentProperties(context, edge), 'shape') ===
        'RECTANGULAR'
          ? 'RECTANGULAR'
          : 'ROUND';
      const diameterM = numericProperty(
        segmentProperties(context, edge),
        'diameterM',
      );
      const widthM = numericProperty(
        segmentProperties(context, edge),
        'widthM',
      );
      const heightM = numericProperty(
        segmentProperties(context, edge),
        'heightM',
      );
      // A run whose terminals are not all described has no cumulated flow —
      // it has a lower bound and a list of what is missing. `null` is what the
      // engine reads as « je ne sais pas » ; the note says which nodes.
      const cumulated = flows.get(edge.id);
      const flowM3h = cumulated === undefined ? undefined : valueOf(cumulated);
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
      if (cumulated !== undefined && cumulated.status === 'UNKNOWN')
        settings.reportMissing(
          'ventilation',
          `segments/${edge.id}/flowM3h`,
          'PROJECT',
          `Duct ${edge.id}: ${describeUnknown(cumulated)}`,
        );
      else if (flowM3h === undefined || flowM3h <= 0)
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
          segmentProperties(context, edge),
        ),
        roughnessM:
          numericProperty(segmentProperties(context, edge), 'roughnessM') ??
          roughnessM,
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
      'Le projet n’a aucun réseau d’eau.',
    );
    return { segments: [] };
  }
  const roughnessM = settings.methodConstant('water', 'pipeRoughnessM');
  const simultaneity = settings.requiredNumber(
    'water',
    'simultaneityFactor',
    'Donnez le coefficient de simultanéité dans les réglages de l’eau.',
  );
  const nodeFlow = new Map(
    networks.flatMap((network) =>
      network.nodes.map((node): readonly [string, number | undefined] => [
        node.id,
        nodeNumber(node, 'designFlowLps'),
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
      const diameterM = numericProperty(
        segmentProperties(context, edge),
        'internalDiameterM',
      );
      const cumulated = flows.get(edge.id);
      const cumulatedLps =
        cumulated === undefined ? undefined : valueOf(cumulated);
      if (diameterM === undefined)
        settings.reportMissing(
          'water',
          `segments/${edge.id}/internalDiameterM`,
          'PROJECT',
          `Pipe ${edge.id} has no internal diameter.`,
        );
      if (cumulated !== undefined && cumulated.status === 'UNKNOWN')
        settings.reportMissing(
          'water',
          `segments/${edge.id}/flow`,
          'PROJECT',
          `Pipe ${edge.id} : ${describeUnknown(cumulated)}`,
        );
      else if (cumulatedLps === undefined || cumulatedLps <= 0)
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
        cumulatedDesignFlowLps: cumulatedLps ?? null,
        flowM3s:
          simultaneity === undefined || cumulatedLps === undefined
            ? null
            : (cumulatedLps * simultaneity) / 1000,
        localLossCoefficient: localLosses(
          settings,
          'water',
          edge.id,
          segmentProperties(context, edge),
        ),
        roughnessM:
          numericProperty(segmentProperties(context, edge), 'roughnessM') ??
          roughnessM,
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
      'Le projet n’a aucun réseau d’évacuation.',
    );
    return { segments: [] };
  }
  const flowPerUnit = settings.requiredNumber(
    'wastewater',
    'designFlowM3sPerDischargeUnit',
    'Donnez le débit par unité de vidange dans les réglages des évacuations.',
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
      const diameterM = numericProperty(
        segmentProperties(context, edge),
        'internalDiameterM',
      );
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
/**
 * The equipment of one kind a calculation should read.
 *
 * What is actually standing in the building answers first. A project holding
 * three models of tank and having placed one is not an ambiguous project, and
 * a project having placed three radiators is not the same project as one
 * having placed a single radiator — which is what reading the catalogue alone
 * made them.
 *
 * A project that has placed nothing falls back to what it declares, because a
 * file drawn before things could be placed still has to compute; it is said
 * plainly rather than assumed, so that the two cases can be told apart.
 */
function equipmentOfKind(
  context: ProjectCalculationContext,
  kind: string,
): {
  /** The catalogue entries to read the figures from, one per placed thing. */
  readonly definitions: readonly EquipmentDefinition[];
  /** How many are standing in the building; zero when none is placed. */
  readonly placed: number;
} {
  const held = new Map(context.equipment.map((entry) => [entry.id, entry]));
  const standing = (context.placedEquipmentByKind[kind] ?? []).flatMap(
    ({ definitionId }) => {
      const found =
        definitionId === undefined ? undefined : held.get(definitionId);
      return found === undefined ? [] : [found];
    },
  );
  return standing.length > 0
    ? { definitions: standing, placed: standing.length }
    : { definitions: context.equipmentByKind[kind] ?? [], placed: 0 };
}

/**
 * The single equipment of one kind, counting what is placed rather than what
 * is catalogued.
 *
 * Two tanks standing in a house is a question for the user; two tanks in the
 * library and one on the plan is not.
 */
function theOnlyPlaced(
  context: ProjectCalculationContext,
  kind: string,
  moduleId: string,
  key: string,
  what: string,
): EquipmentDefinition | undefined {
  const { definitions } = equipmentOfKind(context, kind);
  return theOnly(definitions, context.settings, moduleId, key, what);
}

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
    `Le projet déclare ${items.length} ${what} (${items
      .map(({ id }) => id)
      .join(', ')}) : dites laquelle ce module doit prendre.`,
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
      'Le projet n’a aucun réseau électrique.',
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
        // The thing the node feeds, when it names one: two sockets of the
        // same model are two loads, and a node naming only the model could
        // not say which of them it reached.
        const placed =
          node.componentId === undefined
            ? undefined
            : context.placedEquipment.find(
                ({ instanceId }) => instanceId === node.componentId,
              );
        const equipment = context.equipment.find(
          ({ id }) =>
            id === placed?.definitionId ||
            id === node.equipmentId ||
            id === nodeString(node, 'catalogItemId'),
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
          // Le nœud qui la porte : sans lui, le moteur ne peut pas savoir
          // quels tronçons l'alimentent, donc quel courant y passe.
          nodeId: node.id,
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
          numericProperty(
            segmentProperties(context, edge),
            'conductorSectionMm2',
          ) ?? nodeNumber(circuitNode, 'conductorSectionMm2');
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
        const material = stringProperty(
          segmentProperties(context, edge),
          'conductorMaterial',
        );
        if (material === undefined)
          settings.reportMissing(
            'electrical',
            `cables/${edge.id}/conductorMaterial`,
            'PROJECT',
            `Cable ${edge.id} states no conductor material.`,
          );
        const owners = portOwners(network);
        cables.push({
          id: edge.id,
          circuitId: circuitNode.id,
          networkId: network.id,
          /*
           * Ce que le réseau déclare relier, et non ce que le tracé suggère.
           *
           * Les deux peuvent diverger : quatre câbles de la maison de
           * démonstration ont un tracé qui part à un mètre du nœud dont ils
           * déclarent partir. Un dessin dérive ; une connexion, non.
           */
          fromNodeId: owners.get(edge.fromPortId) ?? null,
          toNodeId: owners.get(edge.toPortId) ?? null,
          path: edge.path.map((point) => ({ ...point })),
          conductorSectionMm2: sectionMm2 ?? null,
          conductorMaterial: material ?? null,
          conductorCount:
            numericProperty(
              segmentProperties(context, edge),
              'conductorCount',
            ) ?? null,
        });
      }
      circuits.push({
        id: circuitNode.id,
        networkId: network.id,
        boardId: board?.id ?? null,
        /*
         * D'où le circuit part, et c'est ce qui donne le sens du courant.
         *
         * Le tableau quand il y en a un ; le nœud du circuit lui-même sinon —
         * c'est là que la protection est posée. Sans ce départ, une guirlande a
         * deux extrémités libres et rien ne dit laquelle alimente l'autre.
         */
        rootNodeId: board?.id ?? circuitNode.id,
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
      'Aucun réseau électrique ne déclare de circuit.',
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
      'La récupération d’eau de pluie demande les précipitations du site : chargez un jeu de données climatiques.',
    );
  else
    settings.note(
      'rainwater',
      'precipitationMm',
      'CLIMATE_DATASET',
      climate.datasetId,
    );
  const tank = theOnlyPlaced(
    context,
    'RAINWATER_TANK',
    'rainwater',
    'tank',
    'cuves de récupération',
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
      'Aucune cuve de récupération ne déclare son volume nominal.',
    );
  const runoffCoefficient = settings.requiredNumber(
    'rainwater',
    'runoffCoefficient',
    'Donnez le coefficient de ruissellement dans les réglages de l’eau de pluie.',
  );
  const preFilterEfficiency = settings.requiredNumber(
    'rainwater',
    'preFilterEfficiency',
    'Donnez le rendement du préfiltre dans les réglages de l’eau de pluie.',
  );
  const dailyDemandL = settings.requiredNumber(
    'rainwater',
    'dailyDemandL',
    'Donnez le besoin journalier en eau non potable dans les réglages de l’eau de pluie.',
  );
  if (context.roofs.length === 0)
    settings.reportMissing(
      'rainwater',
      'surfaces',
      'PROJECT',
      'Le projet ne déclare aucun pan de toiture d’où collecter la pluie.',
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
    /*
     * What is in the tank on the first day is a measurement, and « la cuve est
     * vide » is one of the answers it can have — but nobody said it here. An
     * empty tank makes the first weeks of the balance look worse than they
     * are, and a full one makes them look better; neither is a default.
     *
     * Et c'est un réglage du projet avant d'être une propriété de la cuve.
     * Un fabricant ne livre pas une cuve avec de l'eau dedans : le niveau du
     * premier jour appartient à celui qui simule, au même titre que le besoin
     * journalier et le coefficient de ruissellement, qui sont déjà là. Il se
     * lit donc d'abord dans les réglages, et la fiche ne répond que si le
     * projet se tait — ce qui laisse une cuve instrumentée dire ce qu'elle
     * contient.
     */
    initialVolumeL:
      settings.optionalNumber('rainwater', 'initialVolumeL') ??
      equipmentNumber(context, tank, 'initialVolumeL', 'rainwater') ??
      null,
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
    'Donnez la production de CO₂ par occupant dans les réglages de la qualité de l’air.',
  );
  const initialConcentrationPpm = settings.requiredNumber(
    'iaq',
    'initialConcentrationPpm',
    'Donnez la concentration initiale de CO₂ dans les réglages de la qualité de l’air.',
  );
  const durationHours = settings.requiredNumber(
    'iaq',
    'durationHours',
    'Donnez la durée simulée dans les réglages de la qualité de l’air.',
  );
  const flows = spaceVentilationFlowsM3h(context);
  const rooms = context.spaces.map((space) => {
    const occupants = spaceOccupancy(context, space, 'iaq');
    if (occupants === undefined)
      // Named by the setting that fills it, not by the room that revealed it:
      // eight rooms of one category are one missing figure, and the screen
      // that takes it offers a line per category rather than per room.
      settings.reportMissing(
        'iaq',
        `occupantsByCategory/${space.category}`,
        'MODULE_SETTINGS',
        `No occupancy is declared for category ${space.category}; ${space.name} cannot be assessed.`,
      );
    if (space.volumeM3 === undefined)
      settings.reportMissing(
        'iaq',
        `rooms/${space.spaceId}/volumeM3`,
        'PROJECT',
        space.unresolvedGeometry ??
          `Space ${space.name} has no boundary or storey height to derive a volume from.`,
      );
    const resolvedFlow = flows.get(space.spaceId);
    if (resolvedFlow !== undefined && resolvedFlow.status === 'UNKNOWN')
      settings.reportMissing(
        'iaq',
        `rooms/${space.spaceId}/flowM3h`,
        'PROJECT',
        `${space.name} : ${describeUnknown(resolvedFlow)}`,
      );
    return {
      roomId: space.spaceId,
      name: space.name,
      volumeM3: space.volumeM3 ?? null,
      // A room whose terminals do not all state a flow has no flow to give the
      // air-quality engine: `null` is « je ne sais pas », and the note above
      // says which terminal is silent.
      flowM3h:
        resolvedFlow === undefined ? null : (valueOf(resolvedFlow) ?? null),
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
  // What is on the roof, not what is in the library: two modules of the same
  // model produce twice as much as one, and reading the catalogue alone made
  // the two projects identical.
  const modules = equipmentOfKind(context, 'PHOTOVOLTAIC');
  // Two panels at 450 Wc and a third nobody described are not a 900 Wc
  // installation: they are an installation of at least 900 Wc whose size
  // nobody knows. Adding only what is stated would size an inverter for a
  // field that is bigger than the number says.
  const declaredPower = sumResolved(
    modules.definitions.map((definition) =>
      resolvedNumber(
        equipmentNumber(
          context,
          definition,
          'installedPowerWp',
          'photovoltaic',
        ),
        definition.id,
      ),
    ),
  );
  const installedPowerWp =
    modules.definitions.length === 0 ? undefined : valueOf(declaredPower);
  if (installedPowerWp === undefined)
    settings.reportMissing(
      'photovoltaic',
      'installedPowerWp',
      'EQUIPMENT',
      declaredPower.status === 'UNKNOWN' &&
        declaredPower.missingSourceIds.length > 0
        ? describeUnknown(declaredPower)
        : 'Aucun équipement photovoltaïque ne déclare sa puissance crête installée.',
    );
  else if (modules.placed > 1)
    settings.note(
      'photovoltaic',
      'installedPowerWp',
      'PROJECT',
      `${modules.placed} modules posés`,
    );
  const performanceRatio = settings.requiredNumber(
    'photovoltaic',
    'performanceRatio',
    'Donnez le ratio de performance dans les réglages du photovoltaïque.',
  );
  const climate = context.climate;
  if (climate === undefined)
    settings.reportMissing(
      'photovoltaic',
      'irradiation',
      'CLIMATE_DATASET',
      'La production photovoltaïque demande l’ensoleillement du site : chargez un jeu de données climatiques.',
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
  // A photovoltaic array sits on one plane, and the array placed in the
  // building says which: it is hung on it. Asking the user to state it a
  // second time, in a module setting, would be asking a question the plan has
  // already answered — and the two answers would disagree the first time the
  // array moved.
  const hosted = new Set(
    context.placedEquipment
      // Through the bridge, so a fiche taken from the catalogue is the same
      // thing here as one written before it.
      .filter((placed) => {
        const held = equipmentKindOf(placed);
        return held === 'PHOTOVOLTAIC_MODULE' || held === 'PHOTOVOLTAIC';
      })
      .flatMap(({ hostObjectId }) =>
        hostObjectId === undefined ? [] : [hostObjectId],
      ),
  );
  const candidates =
    hosted.size === 0
      ? context.roofs
      : context.roofs.filter(({ roofId }) => hosted.has(roofId));
  const roof =
    candidates.length <= 1
      ? candidates[0]
      : theOnly(
          candidates.map((entry) => ({ ...entry, id: entry.roofId })),
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
  // The battery that is actually installed, when one is. A library holding two
  // models and a house holding one is not an ambiguous house.
  const battery =
    theOnlyPlaced(
      context,
      'BATTERY',
      'battery',
      'battery',
      'batteries de stockage',
    ) ?? context.battery;
  // What is standing, before what is catalogued: a state of charge is an
  // instance property — the registry says so — so the fiche cannot state it and
  // the battery in the building must. Reading only the definition asked a
  // model to know something only a placement knows.
  const placed = context.placedEquipment.find(
    (entry) =>
      equipmentKindOf(entry) === 'BATTERY' &&
      (battery === undefined || entry.definitionId === battery.id),
  );
  const read = (property: string): number | undefined => {
    const own = placed?.resolvedProperties[property];
    if (typeof own === 'number' && Number.isFinite(own)) {
      settings.note('battery', property, 'EQUIPMENT', placed!.instanceId);
      return own;
    }
    const value = equipmentNumber(context, battery, property, 'battery');
    if (value === undefined)
      settings.reportMissing(
        'battery',
        property,
        'EQUIPMENT',
        `La batterie ne déclare pas ${property}.`,
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
      'Le pilotage du stockage demande un climat au pas infra-journalier régulier : des moyennes mensuelles ne distinguent pas la charge de la décharge.',
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
      'Le bilan énergétique se construit sur les périodes d’un climat au pas régulier.',
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
  const fanPowerW = equipmentOfKind(context, 'FAN').definitions.reduce<number>(
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
    'Donnez la température intérieure de calcul dans les réglages de l’hygrothermie.',
  );
  const indoorRelativeHumidity = settings.requiredNumber(
    'hygrothermal',
    'indoorRelativeHumidity',
    'Donnez l’humidité relative intérieure dans les réglages de l’hygrothermie.',
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
      'Aucune température extérieure n’est disponible pour l’étude des condensations.',
    );
  if (outdoorRelativeHumidity === undefined)
    settings.reportMissing(
      'hygrothermal',
      'outdoorRelativeHumidity',
      'CLIMATE_DATASET',
      'Aucune humidité relative extérieure n’est disponible pour l’étude des condensations.',
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
      'Donnez les bandes d’octave à étudier dans les réglages de l’acoustique.',
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
        space.unresolvedGeometry ??
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
    'Donnez le volume d’eau chaude journalier par occupant dans les réglages de l’ECS.',
  );
  const occupants = settings.requiredNumber(
    'dhw',
    'householdOccupants',
    'Déclarez le nombre d’occupants dans les réglages de l’ECS.',
  );
  const coldWaterTemperatureC = settings.requiredNumber(
    'dhw',
    'coldWaterTemperatureC',
    'Donnez la température d’eau froide d’arrivée dans les réglages de l’ECS.',
  );
  const useTemperatureC = settings.requiredNumber(
    'dhw',
    'useTemperatureC',
    'Donnez la température d’eau chaude à l’usage dans les réglages de l’ECS.',
  );
  const storageTemperatureC = settings.requiredNumber(
    'dhw',
    'storageTemperatureC',
    'Donnez la température de stockage dans les réglages de l’ECS.',
  );
  const annualOperatingDays = settings.requiredNumber(
    'dhw',
    'annualOperatingDays',
    'Donnez le nombre de jours de fonctionnement par an dans les réglages de l’ECS.',
  );
  const tank = theOnlyPlaced(
    context,
    'DHW_TANK',
    'dhw',
    'tank',
    'ballons d’eau chaude',
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
      'Aucun ballon d’eau chaude ne déclare à la fois son volume et sa puissance utile.',
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

/**
 * What a line of the takeoff is priced by.
 *
 * A wall is priced by the material it is built of, per cubic metre. A run is
 * priced by the product it is made of, per metre. A thing standing in the
 * house is priced by its model, each. Three questions, three tables — and
 * until now only the first existed, so a house's whole plumbing, wiring,
 * ductwork and equipment were « counted and not priced ».
 */
interface PricedLine {
  readonly itemId: string;
  readonly sourceEntityId: string;
  readonly materialId: string | null;
  readonly priceKey: string;
  readonly value: number;
  readonly unit: string;
  readonly lot: string;
}

/** The cost engine's own units; the takeoff counts things in « u ». */
function costUnit(unit: string): string {
  return unit === 'u' ? 'each' : unit;
}

function costLotOf(
  context: ProjectCalculationContext,
  line: ProjectQuantityLine,
): string {
  if (line.methodId === 'placed-equipment-v1') return 'OTHER';
  if (line.methodId !== 'network-run-v1') return 'ENVELOPE';
  // The project's own copy answers first: the trade a run belongs to must not
  // change the day somebody reclassifies a tube in the installed catalogue.
  const product =
    context.networkProducts.find(({ id }) => id === line.sourceEntityId) ??
    networkProduct(line.sourceEntityId);
  switch (product?.domain) {
    case 'WATER':
    case 'WASTEWATER':
    case 'RAINWATER':
      return 'PLUMBING';
    case 'VENTILATION':
      return 'VENTILATION';
    case 'ELECTRICAL':
      return 'ELECTRICAL';
    case 'HEATING':
      return 'HEATING';
    default:
      return 'OTHER';
  }
}

function costInput(context: ProjectCalculationContext): CalculationJson {
  const settings = context.settings;
  const currency = settings.optionalString('cost', 'currency') ?? 'EUR';
  const prices = settings.optionalNumberRecord('cost', 'unitPriceByMaterial');
  const wasteFactors = settings.optionalNumberRecord(
    'cost',
    'wasteFactorByMaterial',
  );
  const labourPrices = settings.optionalNumberRecord(
    'cost',
    'labourPriceByMaterial',
  );
  const productPrices = settings.optionalNumberRecord(
    'cost',
    'unitPriceByProduct',
  );
  const productLabour = settings.optionalNumberRecord(
    'cost',
    'labourPriceByProduct',
  );
  const equipmentPrices = settings.optionalNumberRecord(
    'cost',
    'unitPriceByEquipment',
  );
  const equipmentLabour = settings.optionalNumberRecord(
    'cost',
    'labourPriceByEquipment',
  );
  if (prices === undefined)
    settings.reportMissing(
      'cost',
      'unitPriceByMaterial',
      'MODULE_SETTINGS',
      'Déclarez un prix unitaire par matériau, au mètre cube posé, dans les réglages du coût.',
    );

  const priced: PricedLine[] = [];
  const unitPriceByKey: Record<string, number> = {};
  const labourPriceByKey: Record<string, number> = {};
  const wasteFactorByKey: Record<string, number> = {};

  for (const line of context.quantities) {
    // A run nobody has chosen a tube for is a different complaint, and it
    // belongs to the network checks rather than to a total.
    if (line.sourceEntityId === UNNAMED_RUN) continue;
    const kind =
      line.quantityType === 'VOLUME' && line.materialId !== undefined
        ? 'MATERIAL'
        : line.methodId === 'network-run-v1'
          ? 'PRODUCT'
          : line.methodId === 'placed-equipment-v1'
            ? 'EQUIPMENT'
            : undefined;
    if (kind === undefined) continue;
    const key = kind === 'MATERIAL' ? line.materialId! : line.sourceEntityId;
    const table =
      kind === 'MATERIAL'
        ? prices
        : kind === 'PRODUCT'
          ? productPrices
          : equipmentPrices;
    const price = table?.[key];
    if (price === undefined) {
      const [setting, what] =
        kind === 'MATERIAL'
          ? ['unitPriceByMaterial', `material ${key}`]
          : kind === 'PRODUCT'
            ? ['unitPriceByProduct', `${key}, per metre of run`]
            : ['unitPriceByEquipment', `${key}, per unit placed`];
      settings.reportMissing(
        'cost',
        `${setting}/${key}`,
        'MODULE_SETTINGS',
        `No unit price is declared for ${what}.`,
      );
      continue;
    }
    const labour =
      kind === 'MATERIAL'
        ? labourPrices?.[key]
        : kind === 'PRODUCT'
          ? productLabour?.[key]
          : equipmentLabour?.[key];
    unitPriceByKey[key] = price;
    if (labour !== undefined) labourPriceByKey[key] = labour;
    const waste = kind === 'MATERIAL' ? wasteFactors?.[key] : undefined;
    if (waste !== undefined) wasteFactorByKey[key] = waste;
    priced.push({
      itemId: line.itemId,
      sourceEntityId: line.sourceEntityId,
      materialId: line.materialId ?? null,
      priceKey: key,
      value: line.value,
      unit: costUnit(line.unit),
      lot: costLotOf(context, line),
    });
  }

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
    unitPriceByKey,
    labourPriceByKey,
    wasteFactorByKey,
    quantities: priced.map((line) => ({ ...line })),
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
      'Déclarez un facteur d’impact par matériau, avec sa source.',
    );
  if (declarationSource === undefined)
    settings.reportMissing(
      'environmental',
      'declarationSource',
      'MODULE_SETTINGS',
      'Un facteur d’impact doit nommer la déclaration dont il vient.',
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
/** The modules whose answer depends on the weather of a real place. */
const CLIMATE_DEPENDENT = [
  'heating',
  'iaq',
  'rainwater',
  'photovoltaic',
  'energy-balance',
  'hygrothermal',
] as const;

/**
 * What a project asked for and did not get, said once per module that needed
 * it.
 *
 * A climate the project names and nobody supplied is not a reason to compute
 * with another one. Saying which dataset is missing, in the modules that would
 * have read it, is what turns a wrong answer into no answer.
 */
function reportClimateSelection(context: ProjectCalculationContext): void {
  const selection = context.climateSelection;
  if (selection.status === 'OK' || selection.status === 'NONE') return;
  for (const moduleId of CLIMATE_DEPENDENT)
    context.settings.reportMissing(
      moduleId,
      'climateProfileId',
      'CLIMATE_DATASET',
      selection.message,
    );
}

export function buildProjectCalculationInputs(
  context: ProjectCalculationContext,
): ProjectCalculationInputs {
  reportClimateSelection(context);
  // Built from the registry, so adding a module is describing it once rather
  // than in four places.
  const inputs: Record<string, CalculationJson> = Object.fromEntries(
    PROJECT_CALCULATION_MODULE_IDS.map((id) => [
      id,
      MODULE_INPUT_BUILDERS[id](context),
    ]),
  );
  return {
    inputs,
    missing: context.settings.missing,
    provenance: context.settings.provenance,
  };
}
