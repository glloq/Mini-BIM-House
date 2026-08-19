import type { Point3D } from '@house-technical-designer/geometry';

export type NetworkDiscipline =
  | 'WATER'
  | 'WASTEWATER'
  | 'VENTILATION'
  | 'HEATING'
  | 'ELECTRICAL'
  | 'RAINWATER'
  | 'OTHER';
export type PortDirection = 'IN' | 'OUT' | 'BIDIRECTIONAL';

export interface NetworkNode {
  readonly id: string;
  readonly kind: string;
  /** Persisted editor geometry in millimetres. */
  readonly position: Point3D;
  readonly hostObjectId?: string;
  readonly spaceId?: string;
}

export interface NetworkPort {
  readonly id: string;
  readonly nodeId: string;
  readonly role: string;
  readonly direction: PortDirection;
  readonly connectionType?: string;
  readonly nominalSize?: number;
}

export interface NetworkEdge {
  readonly id: string;
  readonly fromPortId: string;
  readonly toPortId: string;
  readonly path: readonly Point3D[];
  readonly kind: string;
  readonly catalogItemId?: string;
  readonly properties?: Readonly<Record<string, unknown>>;
}

export interface TechnicalNetwork {
  readonly id: string;
  readonly discipline: NetworkDiscipline;
  readonly systemType: string;
  readonly nodes: readonly NetworkNode[];
  readonly ports: readonly NetworkPort[];
  readonly edges: readonly NetworkEdge[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type NetworkIssueCode =
  | 'NETWORK_INVALID_ID'
  | 'NETWORK_INVALID_SYSTEM_TYPE'
  | 'NETWORK_DUPLICATE_ID'
  | 'NETWORK_INVALID_POSITION'
  | 'NETWORK_ORPHAN_PORT'
  | 'NETWORK_DISCONNECTED_EDGE'
  | 'NETWORK_INVALID_PATH'
  | 'NETWORK_INCOMPATIBLE_PORTS'
  | 'NETWORK_DUPLICATE_CONNECTION'
  | 'NETWORK_MISSING_SOURCE';

export interface NetworkIssue {
  readonly code: NetworkIssueCode;
  readonly path: string;
  readonly message: string;
}

export function validateTechnicalNetwork(
  network: TechnicalNetwork,
): readonly NetworkIssue[] {
  const issues: NetworkIssue[] = [];
  if (network.id.trim() === '')
    issues.push(
      issue('NETWORK_INVALID_ID', 'id', 'Network ID must not be empty.'),
    );
  if (network.systemType.trim() === '')
    issues.push(
      issue(
        'NETWORK_INVALID_SYSTEM_TYPE',
        'systemType',
        'Network system type must not be empty.',
      ),
    );
  validateEntityIds(network.nodes, 'nodes', issues);
  validateEntityIds(network.ports, 'ports', issues);
  validateEntityIds(network.edges, 'edges', issues);
  const nodes = new Map(network.nodes.map((node) => [node.id, node]));
  const ports = new Map(network.ports.map((port) => [port.id, port]));
  network.nodes.forEach((node, index) => {
    if (
      ![node.position.x, node.position.y, node.position.z].every(
        Number.isFinite,
      )
    )
      issues.push(
        issue(
          'NETWORK_INVALID_POSITION',
          `nodes[${index}].position`,
          `Node ${node.id} position must be finite.`,
        ),
      );
  });
  for (const [index, port] of network.ports.entries()) {
    if (!nodes.has(port.nodeId))
      issues.push(
        issue(
          'NETWORK_ORPHAN_PORT',
          `ports[${index}].nodeId`,
          `Node ${port.nodeId} does not exist.`,
        ),
      );
    if (
      port.nominalSize !== undefined &&
      (!Number.isFinite(port.nominalSize) || port.nominalSize <= 0)
    )
      issues.push(
        issue(
          'NETWORK_INCOMPATIBLE_PORTS',
          `ports[${index}].nominalSize`,
          'Nominal size must be finite and positive.',
        ),
      );
  }
  const connections = new Set<string>();
  const usedPorts = new Set<string>();
  for (const [index, edge] of network.edges.entries()) {
    const from = ports.get(edge.fromPortId);
    const to = ports.get(edge.toPortId);
    if (from === undefined || to === undefined) {
      issues.push(
        issue(
          'NETWORK_DISCONNECTED_EDGE',
          `edges[${index}]`,
          'Both edge ports must exist.',
        ),
      );
    } else {
      if (from.nodeId === to.nodeId || !portsCompatible(from, to))
        issues.push(
          issue(
            'NETWORK_INCOMPATIBLE_PORTS',
            `edges[${index}]`,
            `Ports ${from.id} and ${to.id} are incompatible.`,
          ),
        );
      const key = [from.id, to.id].sort().join('\u0000');
      if (connections.has(key))
        issues.push(
          issue(
            'NETWORK_DUPLICATE_CONNECTION',
            `edges[${index}]`,
            `Ports ${from.id} and ${to.id} are already connected.`,
          ),
        );
      connections.add(key);
      if (usedPorts.has(from.id) || usedPorts.has(to.id))
        issues.push(
          issue(
            'NETWORK_DUPLICATE_CONNECTION',
            `edges[${index}]`,
            'A network port cannot be connected by more than one edge.',
          ),
        );
      usedPorts.add(from.id);
      usedPorts.add(to.id);
    }
    if (!validPath(edge.path))
      issues.push(
        issue(
          'NETWORK_INVALID_PATH',
          `edges[${index}].path`,
          'Path requires two distinct finite 3D points.',
        ),
      );
  }
  if (!network.nodes.some(({ kind }) => kind === 'SOURCE'))
    issues.push(
      issue(
        'NETWORK_MISSING_SOURCE',
        'nodes',
        'Network requires an explicit SOURCE node.',
      ),
    );
  return issues;
}

function validateEntityIds(
  entities: readonly { readonly id: string }[],
  path: string,
  issues: NetworkIssue[],
): void {
  const ids = new Set<string>();
  entities.forEach(({ id }, index) => {
    if (id.trim() === '')
      issues.push(
        issue(
          'NETWORK_INVALID_ID',
          `${path}[${index}].id`,
          'ID must not be empty.',
        ),
      );
    if (ids.has(id))
      issues.push(
        issue(
          'NETWORK_DUPLICATE_ID',
          `${path}[${index}].id`,
          `Duplicate ID ${id}.`,
        ),
      );
    ids.add(id);
  });
}

export function createTechnicalNetwork(
  network: TechnicalNetwork,
): TechnicalNetwork {
  const issues = validateTechnicalNetwork(network);
  if (issues.length > 0)
    throw new RangeError(
      issues.map(({ path, message }) => `${path}: ${message}`).join('; '),
    );
  return structuredClone(network);
}

export function connectedComponents(
  network: TechnicalNetwork,
): readonly (readonly string[])[] {
  const adjacency = nodeAdjacency(network);
  const remaining = new Set(network.nodes.map(({ id }) => id));
  const components: string[][] = [];
  while (remaining.size > 0) {
    const start = [...remaining].sort()[0]!;
    const component: string[] = [];
    const queue = [start];
    remaining.delete(start);
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const neighbour of [...(adjacency.get(current) ?? [])].sort()) {
        if (remaining.delete(neighbour)) queue.push(neighbour);
      }
    }
    components.push(component.sort());
  }
  return components;
}

export function findNodePath(
  network: TechnicalNetwork,
  sourceNodeId: string,
  terminalNodeId: string,
): readonly string[] | undefined {
  const adjacency = nodeAdjacency(network);
  if (!adjacency.has(sourceNodeId) || !adjacency.has(terminalNodeId))
    return undefined;
  const queue = [sourceNodeId];
  const previous = new Map<string, string | undefined>([
    [sourceNodeId, undefined],
  ]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === terminalNodeId) break;
    for (const neighbour of [...(adjacency.get(current) ?? [])].sort()) {
      if (!previous.has(neighbour)) {
        previous.set(neighbour, current);
        queue.push(neighbour);
      }
    }
  }
  if (!previous.has(terminalNodeId)) return undefined;
  const path: string[] = [];
  for (
    let current: string | undefined = terminalNodeId;
    current !== undefined;
    current = previous.get(current)
  )
    path.push(current);
  return path.reverse();
}

export function hasNetworkCycle(network: TechnicalNetwork): boolean {
  const adjacency = nodeAdjacency(network);
  const visited = new Set<string>();
  const visit = (node: string, parent?: string): boolean => {
    visited.add(node);
    for (const neighbour of adjacency.get(node) ?? []) {
      if (!visited.has(neighbour)) {
        if (visit(neighbour, node)) return true;
      } else if (neighbour !== parent) return true;
    }
    return false;
  };
  return [...adjacency.keys()].some(
    (node) => !visited.has(node) && visit(node),
  );
}

function nodeAdjacency(network: TechnicalNetwork): Map<string, Set<string>> {
  const adjacency = new Map(
    network.nodes.map(({ id }) => [id, new Set<string>()]),
  );
  const ports = new Map(network.ports.map((port) => [port.id, port]));
  for (const edge of network.edges) {
    const from = ports.get(edge.fromPortId)?.nodeId;
    const to = ports.get(edge.toPortId)?.nodeId;
    if (
      from === undefined ||
      to === undefined ||
      !adjacency.has(from) ||
      !adjacency.has(to)
    )
      continue;
    adjacency.get(from)!.add(to);
    adjacency.get(to)!.add(from);
  }
  return adjacency;
}

function portsCompatible(from: NetworkPort, to: NetworkPort): boolean {
  const direction =
    (from.direction === 'OUT' || from.direction === 'BIDIRECTIONAL') &&
    (to.direction === 'IN' || to.direction === 'BIDIRECTIONAL');
  const connection =
    from.connectionType === undefined ||
    to.connectionType === undefined ||
    from.connectionType === to.connectionType;
  const size =
    from.nominalSize === undefined ||
    to.nominalSize === undefined ||
    from.nominalSize === to.nominalSize;
  return direction && connection && size;
}

function validPath(path: readonly Point3D[]): boolean {
  if (
    path.length < 2 ||
    path.some((point) => ![point.x, point.y, point.z].every(Number.isFinite))
  )
    return false;
  return path.some(
    (point, index) =>
      index > 0 &&
      (point.x !== path[0]!.x ||
        point.y !== path[0]!.y ||
        point.z !== path[0]!.z),
  );
}

function issue(
  code: NetworkIssueCode,
  path: string,
  message: string,
): NetworkIssue {
  return { code, path, message };
}
