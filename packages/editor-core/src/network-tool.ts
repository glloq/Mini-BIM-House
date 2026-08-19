import {
  validateTechnicalNetwork,
  type NetworkEdge,
  type NetworkNode,
  type NetworkPort,
  type TechnicalNetwork,
} from '@house-technical-designer/core-domain';
import type { Point3D } from '@house-technical-designer/geometry';

export interface NetworkEdit {
  readonly before: TechnicalNetwork;
  readonly after: TechnicalNetwork;
  readonly changedObjectIds: readonly string[];
}

export type NetworkDrawingState =
  | { readonly status: 'IDLE' }
  | {
      readonly status: 'ROUTING';
      readonly fromPortId: string;
      readonly points: readonly Point3D[];
      readonly pointerPoint?: Point3D;
      readonly snappedPortId?: string;
      readonly previewPath: readonly Point3D[];
    };

export interface NetworkToolOptions {
  readonly edgeId: () => string;
  readonly edgeKind: string;
  readonly maximumPortSnapDistanceMm: number;
}

/** UI-independent state machine; previews never mutate the persisted network. */
export class NetworkDrawingTool {
  readonly #options: NetworkToolOptions;
  #state: NetworkDrawingState = { status: 'IDLE' };

  constructor(options: NetworkToolOptions) {
    if (
      !Number.isFinite(options.maximumPortSnapDistanceMm) ||
      options.maximumPortSnapDistanceMm < 0
    )
      throw new RangeError(
        'Port snap distance must be finite and non-negative',
      );
    this.#options = options;
  }

  get state(): NetworkDrawingState {
    return this.#state;
  }

  start(network: TechnicalNetwork, fromPortId: string): NetworkDrawingState {
    const port = requirePort(network, fromPortId);
    if (port.direction === 'IN')
      throw new RangeError(`Port ${port.id} cannot start an outgoing edge`);
    const point = requireNode(network, port.nodeId).position;
    this.#state = routingState(fromPortId, [point]);
    return this.#state;
  }

  updatePointer(
    network: TechnicalNetwork,
    point: Point3D,
  ): NetworkDrawingState {
    finitePoint(point);
    if (this.#state.status !== 'ROUTING') return this.#state;
    const target = nearestCompatiblePort(
      network,
      this.#state.fromPortId,
      point,
      this.#options.maximumPortSnapDistanceMm,
    );
    const pointerPoint =
      target === undefined
        ? point
        : requireNode(network, target.nodeId).position;
    this.#state = routingState(
      this.#state.fromPortId,
      this.#state.points,
      pointerPoint,
      target?.id,
    );
    return this.#state;
  }

  addWaypoint(point: Point3D): NetworkDrawingState {
    finitePoint(point);
    if (this.#state.status !== 'ROUTING') return this.#state;
    const previous = this.#state.points.at(-1)!;
    if (samePoint(previous, point))
      throw new RangeError(
        'A network route segment must have a positive length',
      );
    this.#state = routingState(this.#state.fromPortId, [
      ...this.#state.points,
      point,
    ]);
    return this.#state;
  }

  finish(network: TechnicalNetwork): NetworkEdit | undefined {
    if (
      this.#state.status !== 'ROUTING' ||
      this.#state.snappedPortId === undefined
    )
      return undefined;
    const target = requirePort(network, this.#state.snappedPortId);
    const targetPoint = requireNode(network, target.nodeId).position;
    const path = appendDistinct(this.#state.points, targetPoint);
    const edge: NetworkEdge = {
      id: this.#options.edgeId(),
      fromPortId: this.#state.fromPortId,
      toPortId: target.id,
      kind: this.#options.edgeKind,
      path,
    };
    const after = { ...network, edges: [...network.edges, edge] };
    const existingIssues = new Set(
      validateTechnicalNetwork(network).map(issueFingerprint),
    );
    const newIssues = validateTechnicalNetwork(after).filter(
      (issue) => !existingIssues.has(issueFingerprint(issue)),
    );
    if (newIssues.length > 0)
      throw new RangeError(newIssues.map(({ message }) => message).join('; '));
    this.#state = { status: 'IDLE' };
    return edit(network, after, [edge.id, edge.fromPortId, edge.toPortId]);
  }

  cancel(): NetworkDrawingState {
    this.#state = { status: 'IDLE' };
    return this.#state;
  }
}

function issueFingerprint(issue: {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}): string {
  return `${issue.code}\u0000${issue.path}\u0000${issue.message}`;
}

export function placeNetworkNode(
  network: TechnicalNetwork,
  node: NetworkNode,
  ports: readonly NetworkPort[],
): NetworkEdit {
  finitePoint(node.position);
  if (network.nodes.some(({ id }) => id === node.id))
    throw new RangeError(`Node ${node.id} already exists`);
  if (ports.some((port) => port.nodeId !== node.id))
    throw new RangeError('Placed ports must belong to the placed node');
  const existingPortIds = new Set(network.ports.map(({ id }) => id));
  if (ports.some(({ id }) => existingPortIds.has(id)))
    throw new RangeError('Placed port ID already exists');
  const after = {
    ...network,
    nodes: [...network.nodes, structuredClone(node)],
    ports: [...network.ports, ...structuredClone(ports)],
  };
  return edit(network, after, [node.id, ...ports.map(({ id }) => id)]);
}

export function modifyNetworkEdgePath(
  network: TechnicalNetwork,
  edgeId: string,
  path: readonly Point3D[],
): NetworkEdit {
  const edge = network.edges.find(({ id }) => id === edgeId);
  if (edge === undefined) throw new RangeError(`Edge ${edgeId} does not exist`);
  const after = {
    ...network,
    edges: network.edges.map((candidate) =>
      candidate.id === edgeId
        ? { ...candidate, path: structuredClone(path) }
        : candidate,
    ),
  };
  const invalidPath = validateTechnicalNetwork(after).find(
    ({ code, path: issuePath }) =>
      code === 'NETWORK_INVALID_PATH' && issuePath.includes('path'),
  );
  if (invalidPath !== undefined) throw new RangeError(invalidPath.message);
  return edit(network, after, [edgeId]);
}

function nearestCompatiblePort(
  network: TechnicalNetwork,
  fromPortId: string,
  point: Point3D,
  maximumDistanceMm: number,
): NetworkPort | undefined {
  const from = requirePort(network, fromPortId);
  const connected = new Set(
    network.edges.flatMap((edge) => [edge.fromPortId, edge.toPortId]),
  );
  return network.ports
    .filter((port) => port.id !== from.id && port.nodeId !== from.nodeId)
    .filter((port) => !connected.has(port.id))
    .filter((port) => compatible(from, port))
    .map((port) => ({
      port,
      distance: distance(point, requireNode(network, port.nodeId).position),
    }))
    .filter(({ distance }) => distance <= maximumDistanceMm)
    .sort(
      (first, second) =>
        first.distance - second.distance ||
        first.port.id.localeCompare(second.port.id),
    )[0]?.port;
}

function compatible(from: NetworkPort, to: NetworkPort): boolean {
  return (
    (to.direction === 'IN' || to.direction === 'BIDIRECTIONAL') &&
    (from.connectionType === undefined ||
      to.connectionType === undefined ||
      from.connectionType === to.connectionType) &&
    (from.nominalSize === undefined ||
      to.nominalSize === undefined ||
      from.nominalSize === to.nominalSize)
  );
}

function routingState(
  fromPortId: string,
  points: readonly Point3D[],
  pointerPoint?: Point3D,
  snappedPortId?: string,
): NetworkDrawingState {
  return {
    status: 'ROUTING',
    fromPortId,
    points: structuredClone(points),
    ...(pointerPoint === undefined ? {} : { pointerPoint }),
    ...(snappedPortId === undefined ? {} : { snappedPortId }),
    previewPath:
      pointerPoint === undefined
        ? structuredClone(points)
        : appendDistinct(points, pointerPoint),
  };
}

function edit(
  before: TechnicalNetwork,
  after: TechnicalNetwork,
  changedObjectIds: readonly string[],
): NetworkEdit {
  return {
    before: structuredClone(before),
    after: structuredClone(after),
    changedObjectIds,
  };
}

function requirePort(network: TechnicalNetwork, id: string): NetworkPort {
  const port = network.ports.find((candidate) => candidate.id === id);
  if (port === undefined) throw new RangeError(`Port ${id} does not exist`);
  return port;
}

function requireNode(network: TechnicalNetwork, id: string): NetworkNode {
  const node = network.nodes.find((candidate) => candidate.id === id);
  if (node === undefined) throw new RangeError(`Node ${id} does not exist`);
  return node;
}

function appendDistinct(
  points: readonly Point3D[],
  point: Point3D,
): readonly Point3D[] {
  return samePoint(points.at(-1), point)
    ? structuredClone(points)
    : [...structuredClone(points), structuredClone(point)];
}

function samePoint(first: Point3D | undefined, second: Point3D): boolean {
  return (
    first !== undefined &&
    first.x === second.x &&
    first.y === second.y &&
    first.z === second.z
  );
}

function distance(first: Point3D, second: Point3D): number {
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);
}

function finitePoint(point: Point3D): void {
  if (![point.x, point.y, point.z].every(Number.isFinite))
    throw new RangeError('Network drawing points must be finite');
}
