import type {
  NetworkDiscipline,
  NetworkEdge,
  NetworkNode,
  NetworkPort,
  Project,
  TechnicalNetwork,
} from '@house-technical-designer/core-domain';
import type {
  NetworkNodeTemplate,
  NetworkSummary,
  ProjectCommand,
} from '@house-technical-designer/editor-core';
import {
  AddNetworkCommand,
  AddNetworkNodeCommand,
  AddNetworkPortCommand,
  ConnectNetworkPortsCommand,
  ProjectTransactionCommand,
  RemoveNetworkEdgeCommand,
  NETWORK_DISCIPLINE_LABELS,
  NETWORK_EDGE_KINDS,
  branchingTemplate,
  connectablePorts,
  draftNetwork,
  nearestPointOnRoute,
  findNetwork,
  networkNodeTemplates,
  networkSummary,
  openPorts,
  orthogonalRoute,
  routeThrough,
  slopedRoute,
  templatePorts,
} from '@house-technical-designer/editor-core';
import type { Point2D, Point3D } from '@house-technical-designer/geometry';

export const NETWORK_DISCIPLINES: readonly NetworkDiscipline[] = [
  'WATER',
  'WASTEWATER',
  'RAINWATER',
  'VENTILATION',
  'HEATING',
  'ELECTRICAL',
  'OTHER',
];

export type NetworkCommandResult =
  | { readonly status: 'OK'; readonly command: ProjectCommand }
  | { readonly status: 'ERROR'; readonly message: string };

export interface NetworkRow {
  readonly network: TechnicalNetwork;
  readonly disciplineLabel: string;
  readonly summary: NetworkSummary;
}

export function networkRows(project: Project): readonly NetworkRow[] {
  return (project.systems ?? []).map((network) => ({
    network,
    disciplineLabel: NETWORK_DISCIPLINE_LABELS[network.discipline],
    summary: networkSummary(network),
  }));
}

/** Node kinds, labelled, that the discipline of a network offers. */
export function nodeTemplatesFor(
  network: TechnicalNetwork,
): readonly NetworkNodeTemplate[] {
  return networkNodeTemplates(network.discipline);
}

function templateFor(
  network: TechnicalNetwork,
  kind: string,
): NetworkNodeTemplate | undefined {
  return nodeTemplatesFor(network).find((template) => template.kind === kind);
}

export function nodeKindLabel(network: TechnicalNetwork, kind: string): string {
  return templateFor(network, kind)?.label ?? kind;
}

export interface SpaceOption {
  readonly id: string;
  readonly name: string;
  readonly levelName: string;
}

export function spaceOptions(project: Project): readonly SpaceOption[] {
  return project.building.levels.flatMap((level) =>
    level.spaces.map((space) => ({
      id: space.id,
      name: space.name,
      levelName: level.name,
    })),
  );
}

export interface NodeRow {
  readonly node: NetworkNode;
  readonly kindLabel: string;
  readonly ports: readonly NetworkPort[];
  readonly connectedPortCount: number;
  readonly spaceName?: string;
}

export function nodeRows(
  network: TechnicalNetwork,
  project: Project,
): readonly NodeRow[] {
  const spaces = new Map(
    spaceOptions(project).map((space) => [space.id, space.name]),
  );
  const connected = new Set(
    network.edges.flatMap(({ fromPortId, toPortId }) => [fromPortId, toPortId]),
  );
  return network.nodes.map((node) => {
    const ports = network.ports.filter((port) => port.nodeId === node.id);
    const spaceName =
      node.spaceId === undefined ? undefined : spaces.get(node.spaceId);
    return {
      node,
      kindLabel: nodeKindLabel(network, node.kind),
      ports,
      connectedPortCount: ports.filter(({ id }) => connected.has(id)).length,
      ...(spaceName === undefined ? {} : { spaceName }),
    };
  });
}

export interface EdgeRow {
  readonly edge: NetworkEdge;
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly lengthMm: number;
}

export function edgeRows(network: TechnicalNetwork): readonly EdgeRow[] {
  return network.edges.map((edge) => ({
    edge,
    fromLabel: portLabel(network, edge.fromPortId),
    toLabel: portLabel(network, edge.toPortId),
    lengthMm: pathLength(edge.path),
  }));
}

function pathLength(path: readonly Point3D[]): number {
  return path.reduce((total, point, index) => {
    if (index === 0) return total;
    const previous = path[index - 1]!;
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

/** A port named by the node it belongs to, so a select reads like a plan. */
export function portLabel(network: TechnicalNetwork, portId: string): string {
  const port = network.ports.find(({ id }) => id === portId);
  if (port === undefined) return portId;
  const node = network.nodes.find(({ id }) => id === port.nodeId);
  const kind =
    node === undefined ? port.nodeId : nodeKindLabel(network, node.kind);
  return `${kind} · ${port.role} ${port.direction === 'OUT' ? 'sortant' : port.direction === 'IN' ? 'entrant' : 'bidirectionnel'}`;
}

/** Ports a route may leave from: outgoing, and not already carrying one. */
export function startPorts(network: TechnicalNetwork): readonly NetworkPort[] {
  return openPorts(network).filter(
    ({ direction }) => direction === 'OUT' || direction === 'BIDIRECTIONAL',
  );
}

export function endPorts(
  network: TechnicalNetwork,
  fromPortId: string,
): readonly NetworkPort[] {
  return connectablePorts(network, fromPortId);
}

export interface NetworkDraft {
  readonly id: string;
  readonly discipline: NetworkDiscipline;
  readonly systemType: string;
  readonly position: Point3D;
}

export function createNetworkCommand(
  project: Project,
  draft: NetworkDraft,
): NetworkCommandResult {
  if (draft.systemType.trim() === '')
    return {
      status: 'ERROR',
      message: 'Un réseau demande un type de système explicite.',
    };
  if (findNetwork(project, draft.id) !== undefined)
    return { status: 'ERROR', message: `Le réseau ${draft.id} existe déjà.` };
  const { network } = draftNetwork(
    draft.id,
    draft.discipline,
    draft.systemType.trim(),
    draft.position,
  );
  return { status: 'OK', command: new AddNetworkCommand(network) };
}

export interface NodeDraft {
  readonly nodeId: string;
  readonly kind: string;
  readonly position: Point3D;
  /** The storey the node sits on, so it follows when that storey moves. */
  readonly levelId?: string;
  readonly spaceId?: string;
}

export function placeNodeCommand(
  project: Project,
  networkId: string,
  draft: NodeDraft,
): NetworkCommandResult {
  const network = findNetwork(project, networkId);
  if (network === undefined)
    return {
      status: 'ERROR',
      message: `Le réseau ${networkId} est introuvable.`,
    };
  const template = templateFor(network, draft.kind);
  if (template === undefined)
    return {
      status: 'ERROR',
      message: `Le type de nœud ${draft.kind} n’appartient pas à cette discipline.`,
    };
  const node: NetworkNode = {
    id: draft.nodeId,
    kind: template.kind,
    position: draft.position,
    ...(draft.levelId === undefined ? {} : { levelId: draft.levelId }),
    ...(draft.spaceId === undefined || draft.spaceId === ''
      ? {}
      : { spaceId: draft.spaceId }),
  };
  return {
    status: 'OK',
    command: new AddNetworkNodeCommand(
      networkId,
      node,
      templatePorts(node.id, template, network.systemType),
    ),
  };
}

/**
 * Route between two ports, along the building axes.
 *
 * The route is a drawing, not a measurement: the user can see every corner it
 * places, and the segment carries exactly the path shown on the plan.
 */
export function connectCommand(
  project: Project,
  networkId: string,
  fromPortId: string,
  toPortId: string,
  edgeId: string,
): NetworkCommandResult {
  const network = findNetwork(project, networkId);
  if (network === undefined)
    return {
      status: 'ERROR',
      message: `Le réseau ${networkId} est introuvable.`,
    };
  const from = network.ports.find(({ id }) => id === fromPortId);
  const to = network.ports.find(({ id }) => id === toPortId);
  if (from === undefined || to === undefined)
    return { status: 'ERROR', message: 'Les deux ports doivent exister.' };
  const fromNode = network.nodes.find(({ id }) => id === from.nodeId);
  const toNode = network.nodes.find(({ id }) => id === to.nodeId);
  if (fromNode === undefined || toNode === undefined)
    return { status: 'ERROR', message: 'Les deux nœuds doivent exister.' };
  const edge: NetworkEdge = {
    id: edgeId,
    fromPortId,
    toPortId,
    kind: NETWORK_EDGE_KINDS[network.discipline],
    path: orthogonalRoute(fromNode.position, toNode.position),
  };
  return {
    status: 'OK',
    command: new ConnectNetworkPortsCommand(networkId, edge),
  };
}

/** Extra outgoing port so a manifold, a circuit or a plenum can feed one more branch. */
export function addBranchPortCommand(
  project: Project,
  networkId: string,
  nodeId: string,
  portId: string,
): NetworkCommandResult {
  const network = findNetwork(project, networkId);
  if (network === undefined)
    return {
      status: 'ERROR',
      message: `Le réseau ${networkId} est introuvable.`,
    };
  const node = network.nodes.find(({ id }) => id === nodeId);
  if (node === undefined)
    return { status: 'ERROR', message: `Le nœud ${nodeId} est introuvable.` };
  const template = templateFor(network, node.kind);
  const outgoing = template?.ports.find(({ direction }) => direction === 'OUT');
  if (outgoing === undefined)
    return {
      status: 'ERROR',
      message: `Un nœud « ${nodeKindLabel(network, node.kind)} » ne distribue pas : il ne peut pas recevoir de départ.`,
    };
  return {
    status: 'OK',
    command: new AddNetworkPortCommand(networkId, {
      id: portId,
      nodeId,
      role: outgoing.role,
      direction: 'OUT',
    }),
  };
}

/**
 * Routes a run drawn on the plan, from one port to another.
 *
 * The panel could already connect two ports chosen from two menus, and the
 * route it produced turned once because that is all a menu can say. Drawn on
 * the plan, every corner the user placed is kept — an editor that re-routed
 * around them would be an editor that discards what was drawn.
 */
export function routeCommand(
  project: Project,
  networkId: string,
  picks: readonly (string | undefined)[],
  corners: readonly Point2D[],
  draft: { readonly slopePercent: number; readonly riseMm: number },
  edgeId: string,
): NetworkCommandResult {
  const network = findNetwork(project, networkId);
  if (network === undefined)
    return {
      status: 'ERROR',
      message: `Le réseau ${networkId} est introuvable.`,
    };
  const ends = picks.filter(
    (pick): pick is string =>
      pick !== undefined && network.ports.some(({ id }) => id === pick),
  );
  const fromPortId = ends[0];
  const toPortId = ends[ends.length - 1];
  if (fromPortId === undefined || toPortId === undefined || ends.length < 2)
    return {
      status: 'ERROR',
      message:
        'Un tracé part d’un port et arrive sur un port : cliquez les deux.',
    };
  if (fromPortId === toPortId)
    return {
      status: 'ERROR',
      message: 'Un tronçon relie deux ports différents.',
    };
  const from = network.ports.find(({ id }) => id === fromPortId)!;
  const to = network.ports.find(({ id }) => id === toPortId)!;
  const fromNode = network.nodes.find(({ id }) => id === from.nodeId);
  const toNode = network.nodes.find(({ id }) => id === to.nodeId);
  if (fromNode === undefined || toNode === undefined)
    return { status: 'ERROR', message: 'Les deux nœuds doivent exister.' };
  // The corners are the clicks between the two ports; the ends come from the
  // nodes, whose height is the one the model holds.
  const between = corners.slice(1, Math.max(1, corners.length - 1));
  const arrival = {
    ...toNode.position,
    z: toNode.position.z + draft.riseMm,
  };
  const route = routeThrough(fromNode.position, between, arrival);
  return {
    status: 'OK',
    command: new ConnectNetworkPortsCommand(networkId, {
      id: edgeId,
      fromPortId,
      toPortId,
      kind: NETWORK_EDGE_KINDS[network.discipline],
      path:
        draft.slopePercent === 0
          ? route
          : slopedRoute(route, draft.slopePercent),
    }),
  };
}

/**
 * Splits a run where the user pointed, so a branch can leave from there.
 *
 * A tee is not a shape drawn on a pipe: it is a fitting with a way in and two
 * ways out. The run is cut at that fitting and rebuilt in two, and the spare
 * outlet is left open — which is exactly what an unfinished branch looks like,
 * and what the Networks workspace already reports as one.
 */
export function branchCommand(
  project: Project,
  edgeId: string,
  at: Point2D,
  ids: { readonly nodeId: string; readonly newId: (prefix: string) => string },
): NetworkCommandResult {
  const network = (project.systems ?? []).find((candidate) =>
    candidate.edges.some(({ id }) => id === edgeId),
  );
  const edge = network?.edges.find(({ id }) => id === edgeId);
  if (network === undefined || edge === undefined)
    return {
      status: 'ERROR',
      message: `Le tronçon ${edgeId} est introuvable.`,
    };
  const template = branchingTemplate(network.discipline);
  if (template === undefined)
    return {
      status: 'ERROR',
      message: `La discipline ${NETWORK_DISCIPLINE_LABELS[network.discipline]} n’a pas de pièce de dérivation.`,
    };
  const position = nearestPointOnRoute(edge.path, at);
  if (position === undefined)
    return { status: 'ERROR', message: 'Ce tronçon n’a pas de tracé.' };
  const node: NetworkNode = {
    id: ids.nodeId,
    kind: template.kind,
    position,
  };
  const ports = templatePorts(node.id, template, network.systemType);
  const inlet = ports.find(({ direction }) => direction === 'IN');
  const outlet = ports.find(({ direction }) => direction === 'OUT');
  if (inlet === undefined || outlet === undefined)
    return {
      status: 'ERROR',
      message: 'La pièce de dérivation doit avoir une entrée et une sortie.',
    };
  const spare = { ...outlet, id: `${node.id}-out-branch` };
  const kind = NETWORK_EDGE_KINDS[network.discipline];
  return {
    status: 'OK',
    command: new ProjectTransactionCommand(
      `network:branch:${edgeId}`,
      'Dériver un tronçon',
      [
        new RemoveNetworkEdgeCommand(network.id, edge.id),
        new AddNetworkNodeCommand(network.id, node, [...ports, spare]),
        new ConnectNetworkPortsCommand(network.id, {
          id: ids.newId('edge'),
          fromPortId: edge.fromPortId,
          toPortId: inlet.id,
          kind,
          path: [edge.path[0]!, position],
        }),
        new ConnectNetworkPortsCommand(network.id, {
          id: ids.newId('edge'),
          fromPortId: outlet.id,
          toPortId: edge.toPortId,
          kind,
          path: [position, edge.path[edge.path.length - 1]!],
        }),
      ],
    ),
  };
}
