import type {
  NetworkDiscipline,
  NetworkEdge,
  NetworkIssue,
  NetworkNode,
  NetworkPort,
  PortDirection,
  TechnicalNetwork,
} from '@house-technical-designer/core-domain';
import { validateTechnicalNetwork } from '@house-technical-designer/core-domain';
import type { Point3D } from '@house-technical-designer/geometry';

/** One port a node template creates, named after the node it belongs to. */
export interface NetworkPortTemplate {
  readonly suffix: string;
  readonly role: string;
  readonly direction: PortDirection;
}

/**
 * A kind of node the user can place, with the ports it starts with.
 *
 * Templates carry roles and directions only. They never carry a diameter, a
 * flow rate or a power: those are measured or specified values, and inventing
 * one here would be a silent constant in every downstream calculation.
 */
export interface NetworkNodeTemplate {
  readonly kind: string;
  readonly label: string;
  readonly ports: readonly NetworkPortTemplate[];
}

const FLOW_SOURCE: NetworkPortTemplate = {
  suffix: 'out',
  role: 'FLOW',
  direction: 'OUT',
};
const FLOW_SINK: NetworkPortTemplate = {
  suffix: 'in',
  role: 'FLOW',
  direction: 'IN',
};
const AIR_SOURCE: NetworkPortTemplate = {
  suffix: 'out',
  role: 'AIR',
  direction: 'OUT',
};
const AIR_SINK: NetworkPortTemplate = {
  suffix: 'in',
  role: 'AIR',
  direction: 'IN',
};
const POWER_SOURCE: NetworkPortTemplate = {
  suffix: 'out',
  role: 'POWER',
  direction: 'OUT',
};
const POWER_SINK: NetworkPortTemplate = {
  suffix: 'in',
  role: 'POWER',
  direction: 'IN',
};

const PRESSURISED_FLUID: readonly NetworkNodeTemplate[] = [
  { kind: 'SOURCE', label: 'Arrivée', ports: [FLOW_SOURCE] },
  { kind: 'JUNCTION', label: 'Nourrice', ports: [FLOW_SINK, FLOW_SOURCE] },
  { kind: 'FIXTURE', label: 'Point de puisage', ports: [FLOW_SINK] },
];

const TEMPLATES: Readonly<
  Record<NetworkDiscipline, readonly NetworkNodeTemplate[]>
> = {
  WATER: PRESSURISED_FLUID,
  HEATING: [
    { kind: 'SOURCE', label: 'Générateur', ports: [FLOW_SOURCE] },
    { kind: 'JUNCTION', label: 'Collecteur', ports: [FLOW_SINK, FLOW_SOURCE] },
    { kind: 'EMITTER', label: 'Émetteur', ports: [FLOW_SINK] },
  ],
  WASTEWATER: [
    { kind: 'FIXTURE', label: 'Appareil', ports: [FLOW_SOURCE] },
    {
      kind: 'INSPECTION_CHAMBER',
      label: 'Regard',
      ports: [FLOW_SINK, FLOW_SOURCE],
    },
    { kind: 'OUTLET', label: 'Exutoire', ports: [FLOW_SINK] },
  ],
  RAINWATER: [
    { kind: 'SOURCE', label: 'Descente de toiture', ports: [FLOW_SOURCE] },
    { kind: 'TANK', label: 'Cuve', ports: [FLOW_SINK, FLOW_SOURCE] },
    { kind: 'OUTLET', label: 'Exutoire', ports: [FLOW_SINK] },
  ],
  VENTILATION: [
    { kind: 'FAN', label: 'Groupe', ports: [AIR_SOURCE] },
    { kind: 'JUNCTION', label: 'Piquage', ports: [AIR_SINK, AIR_SOURCE] },
    { kind: 'TERMINAL', label: "Bouche d'extraction", ports: [AIR_SINK] },
    { kind: 'INTAKE', label: "Entrée d'air", ports: [AIR_SOURCE] },
  ],
  ELECTRICAL: [
    { kind: 'DISTRIBUTION_BOARD', label: 'Tableau', ports: [POWER_SOURCE] },
    { kind: 'CIRCUIT', label: 'Circuit', ports: [POWER_SINK, POWER_SOURCE] },
    { kind: 'LUMINAIRE', label: 'Luminaire', ports: [POWER_SINK] },
    { kind: 'OUTLET', label: 'Prise', ports: [POWER_SINK] },
  ],
  OTHER: [
    { kind: 'SOURCE', label: 'Source', ports: [FLOW_SOURCE] },
    { kind: 'JUNCTION', label: 'Nœud', ports: [FLOW_SINK, FLOW_SOURCE] },
    { kind: 'TERMINAL', label: 'Terminal', ports: [FLOW_SINK] },
  ],
};

export function networkNodeTemplates(
  discipline: NetworkDiscipline,
): readonly NetworkNodeTemplate[] {
  return TEMPLATES[discipline] ?? TEMPLATES.OTHER;
}

/** How a routed segment is named in each discipline. */
export const NETWORK_EDGE_KINDS: Readonly<Record<NetworkDiscipline, string>> = {
  WATER: 'PIPE',
  HEATING: 'PIPE',
  WASTEWATER: 'GRAVITY_PIPE',
  RAINWATER: 'GRAVITY_PIPE',
  VENTILATION: 'DUCT',
  ELECTRICAL: 'CABLE',
  OTHER: 'SEGMENT',
};

export const NETWORK_DISCIPLINE_LABELS: Readonly<
  Record<NetworkDiscipline, string>
> = {
  WATER: 'Eau froide et chaude sanitaire',
  WASTEWATER: 'Eaux usées',
  RAINWATER: 'Eaux pluviales',
  VENTILATION: 'Ventilation',
  HEATING: 'Chauffage',
  ELECTRICAL: 'Électricité',
  OTHER: 'Autre',
};

/** Ports the node template creates, named after the node. */
export function templatePorts(
  nodeId: string,
  template: NetworkNodeTemplate,
): readonly NetworkPort[] {
  return template.ports.map((port) => ({
    id: `${nodeId}-${port.suffix}`,
    nodeId,
    role: port.role,
    direction: port.direction,
  }));
}

/**
 * Orthogonal route between two points.
 *
 * Networks are drawn along the building axes, so the default route turns once,
 * following x then y. It is a drawing convention, not a measured length: the
 * user can still edit the route, and the segment carries whatever it is given.
 */
export function orthogonalRoute(
  from: Point3D,
  to: Point3D,
): readonly Point3D[] {
  const corner: Point3D = { x: to.x, y: from.y, z: from.z };
  const points = [from, corner, to];
  return points.filter(
    (point, index) => index === 0 || !samePoint(points[index - 1]!, point),
  );
}

function samePoint(first: Point3D, second: Point3D): boolean {
  return first.x === second.x && first.y === second.y && first.z === second.z;
}

/** Ports no edge reaches, which is what an unfinished network looks like. */
export function openPorts(network: TechnicalNetwork): readonly NetworkPort[] {
  const connected = new Set(
    network.edges.flatMap(({ fromPortId, toPortId }) => [fromPortId, toPortId]),
  );
  return network.ports.filter(({ id }) => !connected.has(id));
}

/** Ports an edge may start from, given a port already chosen as its start. */
export function connectablePorts(
  network: TechnicalNetwork,
  fromPortId: string,
): readonly NetworkPort[] {
  const from = network.ports.find(({ id }) => id === fromPortId);
  if (from === undefined) return [];
  return openPorts(network).filter(
    (port) =>
      port.id !== from.id &&
      port.nodeId !== from.nodeId &&
      (port.direction === 'IN' || port.direction === 'BIDIRECTIONAL') &&
      (from.connectionType === undefined ||
        port.connectionType === undefined ||
        from.connectionType === port.connectionType) &&
      (from.nominalSize === undefined ||
        port.nominalSize === undefined ||
        from.nominalSize === port.nominalSize),
  );
}

export interface NetworkSummary {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly openPortCount: number;
  /** Developed length of every routed segment, in millimetres. */
  readonly routeLengthMm: number;
  readonly issues: readonly NetworkIssue[];
}

export function networkSummary(network: TechnicalNetwork): NetworkSummary {
  return {
    nodeCount: network.nodes.length,
    edgeCount: network.edges.length,
    openPortCount: openPorts(network).length,
    routeLengthMm: network.edges.reduce(
      (total, edge) => total + routeLength(edge),
      0,
    ),
    issues: validateTechnicalNetwork(network),
  };
}

function routeLength(edge: NetworkEdge): number {
  return edge.path.reduce((total, point, index) => {
    if (index === 0) return total;
    const previous = edge.path[index - 1]!;
    return (
      total +
      Math.hypot(
        point.x - previous.x,
        point.y - previous.y,
        point.z - previous.z,
      )
    );
  }, 0);
}

/** A new, empty network with the single source node its discipline expects. */
export function draftNetwork(
  networkId: string,
  discipline: NetworkDiscipline,
  systemType: string,
  sourcePosition: Point3D,
): { readonly network: TechnicalNetwork; readonly source: NetworkNode } {
  const template = networkNodeTemplates(discipline)[0]!;
  const source: NetworkNode = {
    id: `${networkId}:${template.kind.toLowerCase()}`,
    kind: template.kind,
    position: sourcePosition,
  };
  return {
    network: {
      id: networkId,
      discipline,
      systemType,
      nodes: [source],
      ports: [...templatePorts(source.id, template)],
      edges: [],
    },
    source,
  };
}
