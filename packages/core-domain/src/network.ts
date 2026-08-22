import type { Point3D } from '@house-technical-designer/geometry';
import {
  connectionRefusal,
  portType,
} from '@house-technical-designer/technical-types';
import type { JsonValue } from './types.js';

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
  /** The catalogue entry this node stands for, when it stands for one. */
  readonly equipmentId?: string;
  /**
   * The thing placed in the building this node stands for.
   *
   * Two radiators of the same model share a definition and are two different
   * objects, connected at two different places. A node naming only the model
   * cannot say which of them it feeds, so a network could not tell one from
   * the other and the count was lost.
   */
  readonly componentId?: string;
  /**
   * The level the node belongs to.
   *
   * Its position is absolute in the project, so moving a storey has to move
   * what sits on it. Without this, a node placed on the ground floor stayed at
   * the height the ground floor used to have.
   */
  readonly levelId?: string;
  /**
   * What the node carries beyond its position: a design flow, a discharge
   * count, an electrical load.
   *
   * These are specified or measured values. The application never invents one;
   * a property that is absent stays absent, and the calculation says so.
   */
  readonly properties?: Readonly<Record<string, JsonValue>>;
}

export interface NetworkPort {
  readonly id: string;
  readonly nodeId: string;
  /**
   * What kind of port this is, as the registry names them.
   *
   * One field, from which the fluid, the service, the direction and the way it
   * is joined are all read. `role`, `direction` and `connectionType` said the
   * same things separately and in free text, so `HEATING_FLOW`,
   * `heating-flow` and `FLOW_HEATING` were three different roles that
   * connected to nothing, and four fields could disagree with each other about
   * one port.
   *
   * Optional because files written before it exist, and a file that opened
   * yesterday has to open today.
   */
  readonly portTypeId?: string;
  /** What it was called before the kinds were named. Free text. */
  readonly role: string;
  readonly direction: PortDirection;
  readonly connectionType?: string;
  readonly nominalSize?: number;
}

/** What a port is called: its kind's name when it has one, its role if not. */
export function portRole(port: NetworkPort): string {
  const kind =
    port.portTypeId === undefined ? undefined : portType(port.portTypeId);
  return kind?.label ?? port.role;
}

/**
 * Which way it faces, read from its kind when the kind settles the question.
 *
 * Many kinds do not: an eau froide is the same water leaving a manifold and
 * arriving at a tap, so `WATER_COLD` is bidirectional and the port itself says
 * which end of the run it is.
 */
export function portFacing(port: NetworkPort): PortDirection {
  const kind =
    port.portTypeId === undefined ? undefined : portType(port.portTypeId);
  return kind === undefined || kind.direction === 'BIDIRECTIONAL'
    ? port.direction
    : kind.direction;
}

/**
 * Where a port says two different things about itself.
 *
 * A port that declares a kind and then a direction the kind contradicts is a
 * port whose meaning depends on which field the reader happens to trust.
 */
export function portDisagreements(port: NetworkPort): readonly string[] {
  if (port.portTypeId === undefined) return [];
  const kind = portType(port.portTypeId);
  if (kind === undefined) return [`unknown port type ${port.portTypeId}`];
  // A bidirectional kind settles nothing about the end of the run this port
  // is, so the port is the only one saying, and it cannot contradict itself.
  return kind.direction === 'BIDIRECTIONAL' || kind.direction === port.direction
    ? []
    : [
        `declares ${port.portTypeId}, which is ${kind.direction}, and says ${port.direction}`,
      ];
}

/**
 * Why two ports may not be joined, when they may not.
 *
 * The one answer, given once. There were three: the model asked about
 * direction, connection type and nominal size; the editor asked about
 * connection type and nominal size; the catalogue asked about the fluid, the
 * service and the way the two are joined. Three rules for one question is two
 * of them wrong, and the disagreement showed as an editor that drew runs the
 * importer refused.
 *
 * A port that names its kind is answered by the registry, which knows that an
 * eau froide is not an évacuation. A port that names none is answered by what
 * it does say, which is what a file written before the kinds existed carries.
 * Two ports that name nothing are **not** compatible by default: an unknown
 * fluid joined to an unknown fluid is a drawing nobody has checked, and
 * calling it valid is how it stays unchecked.
 */
export type PortCompatibility =
  /** The two kinds are known and they join. */
  | { readonly status: 'COMPATIBLE' }
  /** They are known and they do not. */
  | { readonly status: 'INCOMPATIBLE'; readonly reason: string }
  /**
   * Nothing here settles it.
   *
   * Not a refusal and not an agreement. This used to be answered « rien ne
   * s'y oppose », which the editor read as « compatible » : two ports saying
   * nothing were joined, and a run whose fluid nobody had checked went into
   * the file looking exactly like a checked one.
   */
  | { readonly status: 'UNKNOWN'; readonly reason: string };

export function portCompatibility(
  first: NetworkPort,
  second: NetworkPort,
): PortCompatibility {
  const no = (reason: string): PortCompatibility => ({
    status: 'INCOMPATIBLE',
    reason,
  });
  if (first.nodeId === second.nodeId)
    return no('Un tronçon relie deux nœuds différents.');
  // Which way each end faces. A kind settles this when it is definite; the
  // port says so otherwise.
  if (portFacing(first) === 'IN' && portFacing(second) === 'IN')
    return no(
      `${first.id} et ${second.id} sont deux arrivées : rien ne part de l’une vers l’autre.`,
    );
  if (portFacing(first) === 'OUT' && portFacing(second) === 'OUT')
    return no(`${first.id} et ${second.id} sont deux départs.`);
  if (first.portTypeId !== undefined && second.portTypeId !== undefined) {
    const refusal = connectionRefusal(first.portTypeId, second.portTypeId);
    return refusal === undefined ? { status: 'COMPATIBLE' } : no(refusal);
  }
  // One end names its kind and the other does not. The registry cannot judge
  // half a question, and the half that answers is not the answer.
  if (first.portTypeId !== undefined || second.portTypeId !== undefined) {
    const named = first.portTypeId ?? second.portTypeId!;
    const silent = first.portTypeId === undefined ? first.id : second.id;
    return {
      status: 'UNKNOWN',
      reason: `Un raccordement déclare ${named} et ${silent} ne déclare pas de genre : rien ne dit si les deux se raccordent.`,
    };
  }
  // What the older files say instead of a kind. Same shape, and no more
  // authority than it ever had: it can refuse, it cannot certify.
  if (
    first.connectionType !== undefined &&
    second.connectionType !== undefined &&
    first.connectionType !== second.connectionType
  )
    return no(
      `${first.connectionType} et ${second.connectionType} ne se raccordent pas.`,
    );
  if (
    first.nominalSize !== undefined &&
    second.nominalSize !== undefined &&
    first.nominalSize !== second.nominalSize
  )
    return no(
      `${first.nominalSize} et ${second.nominalSize} ne sont pas le même calibre.`,
    );
  return {
    status: 'UNKNOWN',
    reason: `Ni ${first.id} ni ${second.id} ne déclare le genre de ce qu’il transporte : rien ne dit si les deux se raccordent.`,
  };
}

/**
 * Why two ports may not be joined, when something says they may not.
 *
 * What a file already holds is judged by this: a run drawn before the kinds
 * existed is not refused for being old. What is *drawn now* is judged by
 * `portsConnectable`, which requires an actual agreement.
 */
export function connectionRefusalBetween(
  first: NetworkPort,
  second: NetworkPort,
): string | undefined {
  const verdict = portCompatibility(first, second);
  return verdict.status === 'INCOMPATIBLE' ? verdict.reason : undefined;
}

/**
 * Whether two ports may be joined without anybody having to decide.
 *
 * Only a real agreement counts. An undetermined pair is offered to the user to
 * force deliberately, never joined on its behalf.
 */
export function portsConnectable(
  first: NetworkPort,
  second: NetworkPort,
): boolean {
  return portCompatibility(first, second).status === 'COMPATIBLE';
}

export interface NetworkEdge {
  readonly id: string;
  readonly fromPortId: string;
  readonly toPortId: string;
  readonly path: readonly Point3D[];
  readonly kind: string;
  readonly catalogItemId?: string;
  /**
   * The product this run is made of.
   *
   * A bore, a roughness, a conductor section and a pressure class are
   * properties of a tube, not of a run of it; a project uses the same tube on
   * forty runs. They were copied onto every segment by hand, from a datasheet,
   * forty times per project — and a figure entered by hand forty times is a
   * figure wrong at least once, with nothing to say which.
   */
  readonly productId?: string;
  /** The version of that product this run was drawn with. */
  readonly productVersion?: string;
  /**
   * What the segment is made of: bore, material, slope, conductor section.
   *
   * Scalars only, like the node record and like the schema: a value TypeScript
   * accepted and serialisation refused would be a project that cannot be saved.
   */
  readonly properties?: Readonly<Record<string, JsonValue>>;
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
  | 'NETWORK_INVALID_PROPERTY'
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
    for (const [key, value] of Object.entries(node.properties ?? {}))
      if (typeof value === 'number' && !Number.isFinite(value))
        issues.push(
          issue(
            'NETWORK_INVALID_PROPERTY',
            `nodes[${index}].properties.${key}`,
            `Node ${node.id} property ${key} is not a number.`,
          ),
        );
  });
  network.edges.forEach((edge, index) => {
    for (const [key, value] of Object.entries(edge.properties ?? {}))
      if (typeof value === 'number' && !Number.isFinite(value))
        issues.push(
          issue(
            'NETWORK_INVALID_PROPERTY',
            `edges[${index}].properties.${key}`,
            `Segment ${edge.id} property ${key} is not a number.`,
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
      const refusal = connectionRefusalBetween(from, to);
      if (refusal !== undefined)
        issues.push(
          issue('NETWORK_INCOMPATIBLE_PORTS', `edges[${index}]`, refusal),
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
  const roots = NETWORK_ROOT_KINDS[network.discipline];
  if (!network.nodes.some(({ kind }) => roots.includes(kind)))
    issues.push(
      issue(
        'NETWORK_MISSING_SOURCE',
        'nodes',
        `A ${network.discipline} network is anchored by one of: ${roots.join(', ')}.`,
      ),
    );
  return issues;
}

/**
 * What anchors a network of each discipline.
 *
 * Not every system starts at a source. Waste water starts nowhere and ends at
 * an outfall; a ventilation system is anchored by its unit; electricity by the
 * board that feeds it. Requiring a node called SOURCE everywhere flagged
 * networks the editor's own templates had just produced.
 */
export const NETWORK_ROOT_KINDS: Readonly<
  Record<NetworkDiscipline, readonly string[]>
> = {
  WATER: ['SOURCE'],
  HEATING: ['SOURCE'],
  RAINWATER: ['SOURCE', 'TANK'],
  WASTEWATER: ['OUTLET'],
  // The ventilation domain names its own anchors: a unit, an intake, or the
  // generic source a simple extract system starts from.
  VENTILATION: ['FAN', 'AIR_HANDLING_UNIT', 'INTAKE', 'SOURCE'],
  ELECTRICAL: ['DISTRIBUTION_BOARD', 'SOURCE'],
  OTHER: ['SOURCE'],
};

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

/**
 * How far a port sits from the node it belongs to, on the plan.
 *
 * A port has no position in the model, and it should not: it is a place on an
 * appliance, not a place in the house. But a drawing has to put it somewhere
 * for the user to point at it, so its place is derived from the node's — near
 * enough to read as belonging to it, far enough to be clicked on its own.
 */
export const PORT_ANCHOR_RADIUS_MM = 180;

/**
 * Where each port of a network falls on the plan, derived and never stored.
 *
 * The ports of one node are spread evenly around it, in the order they are
 * declared, so the same project always draws them the same way.
 */
export function portAnchors(
  network: TechnicalNetwork,
): ReadonlyMap<string, Point3D> {
  const byNode = new Map<string, NetworkPort[]>();
  for (const port of network.ports) {
    const held = byNode.get(port.nodeId);
    if (held === undefined) byNode.set(port.nodeId, [port]);
    else held.push(port);
  }
  const anchors = new Map<string, Point3D>();
  for (const node of network.nodes) {
    const ports = byNode.get(node.id) ?? [];
    for (const [index, port] of ports.entries()) {
      const angle = (2 * Math.PI * index) / Math.max(1, ports.length);
      anchors.set(port.id, {
        x: node.position.x + Math.cos(angle) * PORT_ANCHOR_RADIUS_MM,
        y: node.position.y + Math.sin(angle) * PORT_ANCHOR_RADIUS_MM,
        z: node.position.z,
      });
    }
  }
  return anchors;
}
