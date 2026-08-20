import type {
  JsonValue,
  NetworkEdge,
  NetworkIssue,
  NetworkNode,
  NetworkPort,
  Project,
  TechnicalNetwork,
} from '@house-technical-designer/core-domain';
import { validateTechnicalNetwork } from '@house-technical-designer/core-domain';
import {
  edgePropertySchema,
  incoherentNetworkProperties,
  invalidNetworkProperties,
  nodePropertySchema,
} from './network-properties.js';
import type { Point3D } from '@house-technical-designer/geometry';
import type { ChangeSet, CommandValidation } from './commands.js';
import type {
  ProjectCommand,
  ProjectCommandExecution,
} from './project-commands.js';

/**
 * Everything a network edit can invalidate.
 *
 * A network feeds the discipline modules and the quantities alike, so an edit
 * invalidates all of them rather than guessing which one cared.
 */
const NETWORK_DOMAINS = [
  'water',
  'wastewater',
  'rainwater',
  'ventilation',
  'iaq',
  'electrical',
  'lighting',
  'heating',
  'dhw',
  'quantities',
  'cost',
  'drawing-overlays',
] as const;

function networkChanges(...objectIds: readonly string[]): ChangeSet {
  return { objectIds, domains: [...NETWORK_DOMAINS] };
}

function ok(): CommandValidation {
  return { valid: true };
}

function rejected(...errors: readonly string[]): CommandValidation {
  return { valid: false, errors: [...errors] };
}

export function projectNetworks(project: Project): readonly TechnicalNetwork[] {
  return project.systems ?? [];
}

export function findNetwork(
  project: Project,
  networkId: string,
): TechnicalNetwork | undefined {
  return projectNetworks(project).find(({ id }) => id === networkId);
}

function withNetworks(
  project: Project,
  next: readonly TechnicalNetwork[],
): Project {
  return { ...project, systems: next };
}

function replaceNetwork(project: Project, next: TechnicalNetwork): Project {
  return withNetworks(
    project,
    projectNetworks(project).map((network) =>
      network.id === next.id ? next : network,
    ),
  );
}

function issueFingerprint(issue: NetworkIssue): string {
  return `${issue.code} ${issue.path} ${issue.message}`;
}

/**
 * Issues an edit would introduce, ignoring those the network already carried.
 *
 * A network can be imperfect before the edit — a gravity drainage system has no
 * SOURCE node, for instance — and refusing every later edit because of a
 * pre-existing complaint would make it uneditable. Only what the edit itself
 * breaks is rejected.
 */
export function newNetworkIssues(
  before: TechnicalNetwork,
  after: TechnicalNetwork,
): readonly NetworkIssue[] {
  const known = new Set(validateTechnicalNetwork(before).map(issueFingerprint));
  return validateTechnicalNetwork(after).filter(
    (issue) => !known.has(issueFingerprint(issue)),
  );
}

function validateEdit(
  project: Project,
  networkId: string,
  edit: (network: TechnicalNetwork) => TechnicalNetwork,
): CommandValidation {
  const before = findNetwork(project, networkId);
  if (before === undefined)
    return rejected(`Le réseau ${networkId} est introuvable.`);
  let after: TechnicalNetwork;
  try {
    after = edit(before);
  } catch (error) {
    return rejected(error instanceof Error ? error.message : String(error));
  }
  const issues = newNetworkIssues(before, after);
  return issues.length > 0
    ? rejected(...issues.map(({ message }) => message))
    : ok();
}

abstract class NetworkCommand implements ProjectCommand {
  constructor(
    readonly id: string,
    readonly label: string,
  ) {}
  abstract validate(project: Project): CommandValidation;
  protected abstract apply(project: Project): Project;
  execute(project: Project): ProjectCommandExecution {
    return {
      nextState: this.apply(project),
      changes: networkChanges(this.id),
      inverse: new RestoreNetworksCommand(
        `${this.id}:inverse`,
        `Annuler ${this.label}`,
        projectNetworks(project),
      ),
    };
  }
}

/** Restores a previous set of networks; used as the inverse of a network edit. */
export class RestoreNetworksCommand implements ProjectCommand {
  constructor(
    readonly id: string,
    readonly label: string,
    readonly previous: readonly TechnicalNetwork[],
  ) {}
  validate(): CommandValidation {
    return ok();
  }
  execute(project: Project): ProjectCommandExecution {
    return {
      nextState: withNetworks(project, this.previous),
      changes: networkChanges(this.id),
      inverse: new RestoreNetworksCommand(
        `${this.id}:inverse`,
        `Rétablir ${this.label}`,
        projectNetworks(project),
      ),
    };
  }
}

export class AddNetworkCommand extends NetworkCommand {
  constructor(readonly network: TechnicalNetwork) {
    super(
      `network:add:${network.id}`,
      `Ajouter le réseau ${network.systemType}`,
    );
  }
  validate(project: Project): CommandValidation {
    if (findNetwork(project, this.network.id) !== undefined)
      return rejected(`Le réseau ${this.network.id} existe déjà.`);
    // A network being created has not been fed yet, and a gravity drainage
    // system never carries a SOURCE node at all. The missing source is
    // reported to the user as an open issue instead of blocking the creation.
    const issues = validateTechnicalNetwork(this.network).filter(
      ({ code }) => code !== 'NETWORK_MISSING_SOURCE',
    );
    return issues.length > 0
      ? rejected(...issues.map(({ message }) => message))
      : ok();
  }
  protected apply(project: Project): Project {
    return withNetworks(project, [
      ...projectNetworks(project),
      structuredClone(this.network),
    ]);
  }
}

export class RemoveNetworkCommand extends NetworkCommand {
  constructor(readonly networkId: string) {
    super(`network:remove:${networkId}`, `Supprimer le réseau ${networkId}`);
  }
  validate(project: Project): CommandValidation {
    return findNetwork(project, this.networkId) === undefined
      ? rejected(`Le réseau ${this.networkId} est introuvable.`)
      : ok();
  }
  protected apply(project: Project): Project {
    return withNetworks(
      project,
      projectNetworks(project).filter(({ id }) => id !== this.networkId),
    );
  }
}

/** Node added to an existing network, together with the ports it carries. */
/**
 * Where an object of the building sits, and what it is.
 *
 * A node names a room and an object it is fixed to; both live on a level, and
 * the answer is needed to tell whether the node describes a place that exists.
 */
function buildingObjectLevel(
  project: Project,
  objectId: string,
): { readonly levelId: string; readonly isSpace: boolean } | undefined {
  for (const level of project.building.levels) {
    if (level.spaces.some(({ id }) => id === objectId))
      return { levelId: level.id, isSpace: true };
    if (
      [...level.walls, ...level.slabs, ...level.roofs, ...level.openings].some(
        ({ id }) => id === objectId,
      )
    )
      return { levelId: level.id, isSpace: false };
  }
  return undefined;
}

/**
 * What makes a node impossible, beyond each of its references existing.
 *
 * A node on the ground floor, in a bedroom upstairs, fixed to a wall of a third
 * level names three real objects and no real place. The importer refuses such a
 * project, so the editor must never write one: a file the application cannot
 * read back is worse than an edit refused.
 */
export function incoherentNodePlacement(
  project: Project,
  node: NetworkNode,
): readonly string[] {
  const errors: string[] = [];
  const levelId = node.levelId;
  if (
    levelId !== undefined &&
    !project.building.levels.some(({ id }) => id === levelId)
  )
    errors.push(`Le niveau ${levelId} est introuvable.`);
  const space =
    node.spaceId === undefined
      ? undefined
      : buildingObjectLevel(project, node.spaceId);
  if (node.spaceId !== undefined && space?.isSpace !== true)
    errors.push(`La pièce ${node.spaceId} est introuvable.`);
  // Equipment belongs to the project rather than to a level; a node hosted by
  // one says nothing about where it is, and nothing is claimed about it.
  const host =
    node.hostObjectId === undefined
      ? undefined
      : buildingObjectLevel(project, node.hostObjectId);
  if (
    node.hostObjectId !== undefined &&
    host === undefined &&
    !(project.equipment ?? []).some(({ id }) => id === node.hostObjectId)
  )
    errors.push(`L'objet support ${node.hostObjectId} est introuvable.`);
  if (levelId !== undefined) {
    if (space?.isSpace === true && space.levelId !== levelId)
      errors.push(
        `La pièce ${node.spaceId} est au niveau ${space.levelId}, pas au niveau ${levelId}.`,
      );
    if (host !== undefined && host.levelId !== levelId)
      errors.push(
        `L'objet support ${node.hostObjectId} est au niveau ${host.levelId}, pas au niveau ${levelId}.`,
      );
  } else if (
    space?.isSpace === true &&
    host !== undefined &&
    space.levelId !== host.levelId
  )
    errors.push(
      `La pièce ${node.spaceId} est au niveau ${space.levelId} et l'objet support ${node.hostObjectId} au niveau ${host.levelId}.`,
    );
  return errors;
}

export class AddNetworkNodeCommand extends NetworkCommand {
  constructor(
    readonly networkId: string,
    readonly node: NetworkNode,
    readonly ports: readonly NetworkPort[],
  ) {
    super(
      `network:node:add:${networkId}:${node.id}`,
      'Ajouter un nœud au réseau',
    );
  }
  validate(project: Project): CommandValidation {
    const placement = incoherentNodePlacement(project, this.node);
    if (placement.length > 0) return rejected(...placement);
    return validateEdit(project, this.networkId, (network) =>
      addNode(network, this.node, this.ports),
    );
  }
  protected apply(project: Project): Project {
    const network = requireNetwork(project, this.networkId);
    return replaceNetwork(project, addNode(network, this.node, this.ports));
  }
}

/** Node removal that also drops its ports and every edge reaching them. */
export class RemoveNetworkNodeCommand extends NetworkCommand {
  constructor(
    readonly networkId: string,
    readonly nodeId: string,
  ) {
    super(
      `network:node:remove:${networkId}:${nodeId}`,
      'Supprimer un nœud du réseau',
    );
  }
  validate(project: Project): CommandValidation {
    const network = findNetwork(project, this.networkId);
    if (network === undefined)
      return rejected(`Le réseau ${this.networkId} est introuvable.`);
    return network.nodes.some(({ id }) => id === this.nodeId)
      ? validateEdit(project, this.networkId, (candidate) =>
          removeNode(candidate, this.nodeId),
        )
      : rejected(`Le nœud ${this.nodeId} est introuvable.`);
  }
  protected apply(project: Project): Project {
    return replaceNetwork(
      project,
      removeNode(requireNetwork(project, this.networkId), this.nodeId),
    );
  }
}

/** What a node edit may change; anything left out keeps its current value. */
export interface NetworkNodePatch {
  readonly position?: Point3D;
  readonly kind?: string;
  /** `null` clears the space a node was assigned to. */
  readonly spaceId?: string | null;
  /** `null` clears the equipment a node stood for. */
  readonly equipmentId?: string | null;
  /** The whole property record; an absent key means the property is absent. */
  readonly properties?: Readonly<Record<string, JsonValue>>;
}

/**
 * Moves a node, or restates which space it serves.
 *
 * Moving a node drags the ends of the segments that reach it: leaving a route
 * behind would draw a network that is no longer connected to what it feeds.
 * Only the endpoints follow, so an intermediate route the user drew by hand is
 * preserved.
 */
export class UpdateNetworkNodeCommand extends NetworkCommand {
  constructor(
    readonly networkId: string,
    readonly nodeId: string,
    readonly patch: NetworkNodePatch,
  ) {
    super(
      `network:node:update:${networkId}:${nodeId}`,
      'Modifier un nœud du réseau',
    );
  }
  validate(project: Project): CommandValidation {
    const network = findNetwork(project, this.networkId);
    if (network === undefined)
      return rejected(`Le réseau ${this.networkId} est introuvable.`);
    if (!network.nodes.some(({ id }) => id === this.nodeId))
      return rejected(`Le nœud ${this.nodeId} est introuvable.`);
    if (this.patch.kind !== undefined && this.patch.kind.trim() === '')
      return rejected('Le type de nœud ne peut pas être vide.');
    if (
      typeof this.patch.equipmentId === 'string' &&
      !(project.equipment ?? []).some(({ id }) => id === this.patch.equipmentId)
    )
      return rejected(
        `L'équipement ${this.patch.equipmentId} n'existe pas dans ce projet.`,
      );
    if (this.patch.properties !== undefined) {
      const node = network.nodes.find(({ id }) => id === this.nodeId)!;
      const errors = invalidNetworkProperties(
        nodePropertySchema(network.discipline, this.patch.kind ?? node.kind),
        this.patch.properties,
      );
      if (errors.length > 0) return rejected(...errors);
    }
    // Assigning a room upstairs to a node declared downstairs would write a
    // project this application refuses to read back.
    const edited = updateNode(network, this.nodeId, this.patch).nodes.find(
      ({ id }) => id === this.nodeId,
    );
    if (edited !== undefined) {
      const placement = incoherentNodePlacement(project, edited);
      if (placement.length > 0) return rejected(...placement);
    }
    return validateEdit(project, this.networkId, (candidate) =>
      updateNode(candidate, this.nodeId, this.patch),
    );
  }
  protected apply(project: Project): Project {
    return replaceNetwork(
      project,
      updateNode(
        requireNetwork(project, this.networkId),
        this.nodeId,
        this.patch,
      ),
    );
  }
}

export class AddNetworkPortCommand extends NetworkCommand {
  constructor(
    readonly networkId: string,
    readonly port: NetworkPort,
  ) {
    super(
      `network:port:add:${networkId}:${port.id}`,
      'Ajouter un port au réseau',
    );
  }
  validate(project: Project): CommandValidation {
    return validateEdit(project, this.networkId, (network) =>
      addPort(network, this.port),
    );
  }
  protected apply(project: Project): Project {
    return replaceNetwork(
      project,
      addPort(requireNetwork(project, this.networkId), this.port),
    );
  }
}

export class RemoveNetworkPortCommand extends NetworkCommand {
  constructor(
    readonly networkId: string,
    readonly portId: string,
  ) {
    super(
      `network:port:remove:${networkId}:${portId}`,
      'Supprimer un port du réseau',
    );
  }
  validate(project: Project): CommandValidation {
    const network = findNetwork(project, this.networkId);
    if (network === undefined)
      return rejected(`Le réseau ${this.networkId} est introuvable.`);
    if (!network.ports.some(({ id }) => id === this.portId))
      return rejected(`Le port ${this.portId} est introuvable.`);
    return network.edges.some(
      ({ fromPortId, toPortId }) =>
        fromPortId === this.portId || toPortId === this.portId,
    )
      ? rejected(
          `Le port ${this.portId} porte un tronçon : supprimez le tronçon avant le port.`,
        )
      : ok();
  }
  protected apply(project: Project): Project {
    const network = requireNetwork(project, this.networkId);
    return replaceNetwork(project, {
      ...network,
      ports: network.ports.filter(({ id }) => id !== this.portId),
    });
  }
}

/** Edge joining two ports along an explicit route. */
export class ConnectNetworkPortsCommand extends NetworkCommand {
  constructor(
    readonly networkId: string,
    readonly edge: NetworkEdge,
  ) {
    super(
      `network:edge:add:${networkId}:${edge.id}`,
      'Relier deux ports du réseau',
    );
  }
  validate(project: Project): CommandValidation {
    return validateEdit(project, this.networkId, (network) =>
      addEdge(network, this.edge),
    );
  }
  protected apply(project: Project): Project {
    return replaceNetwork(
      project,
      addEdge(requireNetwork(project, this.networkId), this.edge),
    );
  }
}

/**
 * States what a routed segment is made of.
 *
 * The route says where the pipe runs; these properties say what it is — its
 * bore, its material, its slope. Without them a module can draw the network and
 * still refuse to size it, which is exactly what it should do.
 */
export class UpdateNetworkEdgeCommand extends NetworkCommand {
  constructor(
    readonly networkId: string,
    readonly edgeId: string,
    readonly properties: Readonly<Record<string, JsonValue>>,
  ) {
    super(
      `network:edge:update:${networkId}:${edgeId}`,
      'Modifier un tronçon du réseau',
    );
  }
  validate(project: Project): CommandValidation {
    const network = findNetwork(project, this.networkId);
    if (network === undefined)
      return rejected(`Le réseau ${this.networkId} est introuvable.`);
    if (!network.edges.some(({ id }) => id === this.edgeId))
      return rejected(`Le tronçon ${this.edgeId} est introuvable.`);
    const errors = [
      ...invalidNetworkProperties(
        edgePropertySchema(network.discipline),
        this.properties,
      ),
      ...incoherentNetworkProperties(network.discipline, this.properties),
    ];
    if (errors.length > 0) return rejected(...errors);
    return validateEdit(project, this.networkId, (candidate) =>
      updateEdge(candidate, this.edgeId, this.properties),
    );
  }
  protected apply(project: Project): Project {
    return replaceNetwork(
      project,
      updateEdge(
        requireNetwork(project, this.networkId),
        this.edgeId,
        this.properties,
      ),
    );
  }
}

export class RemoveNetworkEdgeCommand extends NetworkCommand {
  constructor(
    readonly networkId: string,
    readonly edgeId: string,
  ) {
    super(
      `network:edge:remove:${networkId}:${edgeId}`,
      'Supprimer un tronçon du réseau',
    );
  }
  validate(project: Project): CommandValidation {
    const network = findNetwork(project, this.networkId);
    if (network === undefined)
      return rejected(`Le réseau ${this.networkId} est introuvable.`);
    return network.edges.some(({ id }) => id === this.edgeId)
      ? ok()
      : rejected(`Le tronçon ${this.edgeId} est introuvable.`);
  }
  protected apply(project: Project): Project {
    const network = requireNetwork(project, this.networkId);
    return replaceNetwork(project, {
      ...network,
      edges: network.edges.filter(({ id }) => id !== this.edgeId),
    });
  }
}

function requireNetwork(project: Project, networkId: string): TechnicalNetwork {
  const network = findNetwork(project, networkId);
  if (network === undefined)
    throw new RangeError(`Le réseau ${networkId} est introuvable.`);
  return network;
}

function addNode(
  network: TechnicalNetwork,
  node: NetworkNode,
  ports: readonly NetworkPort[],
): TechnicalNetwork {
  if (network.nodes.some(({ id }) => id === node.id))
    throw new RangeError(`Le nœud ${node.id} existe déjà.`);
  if (ports.some((port) => port.nodeId !== node.id))
    throw new RangeError('Les ports créés doivent appartenir au nœud créé.');
  return {
    ...network,
    nodes: [...network.nodes, structuredClone(node)],
    ports: [...network.ports, ...structuredClone(ports)],
  };
}

function removeNode(
  network: TechnicalNetwork,
  nodeId: string,
): TechnicalNetwork {
  const removedPorts = new Set(
    network.ports.filter((port) => port.nodeId === nodeId).map(({ id }) => id),
  );
  return {
    ...network,
    nodes: network.nodes.filter(({ id }) => id !== nodeId),
    ports: network.ports.filter((port) => port.nodeId !== nodeId),
    edges: network.edges.filter(
      ({ fromPortId, toPortId }) =>
        !removedPorts.has(fromPortId) && !removedPorts.has(toPortId),
    ),
  };
}

function updateEdge(
  network: TechnicalNetwork,
  edgeId: string,
  properties: Readonly<Record<string, JsonValue>>,
): TechnicalNetwork {
  return {
    ...network,
    edges: network.edges.map((edge) => {
      if (edge.id !== edgeId) return edge;
      const { properties: _previous, ...rest } = edge;
      return Object.keys(properties).length === 0
        ? rest
        : { ...rest, properties: structuredClone(properties) };
    }),
  };
}

function updateNode(
  network: TechnicalNetwork,
  nodeId: string,
  patch: NetworkNodePatch,
): TechnicalNetwork {
  const current = network.nodes.find(({ id }) => id === nodeId);
  if (current === undefined)
    throw new RangeError(`Le nœud ${nodeId} est introuvable.`);
  const {
    spaceId: _previousSpaceId,
    equipmentId: _previousEquipmentId,
    properties: previousProperties,
    ...rest
  } = current;
  const spaceId = patch.spaceId === undefined ? current.spaceId : patch.spaceId;
  const equipmentId =
    patch.equipmentId === undefined ? current.equipmentId : patch.equipmentId;
  const properties = patch.properties ?? previousProperties;
  const next: NetworkNode = {
    ...rest,
    ...(patch.kind === undefined ? {} : { kind: patch.kind }),
    ...(patch.position === undefined
      ? {}
      : { position: structuredClone(patch.position) }),
    ...(spaceId === null || spaceId === undefined ? {} : { spaceId }),
    ...(equipmentId === null || equipmentId === undefined
      ? {}
      : { equipmentId }),
    // An empty record is dropped rather than stored: a node with no property is
    // a node the file says nothing about, which is what it means.
    ...(properties === undefined || Object.keys(properties).length === 0
      ? {}
      : { properties: structuredClone(properties) }),
  };
  const movedPorts = new Set(
    network.ports.filter((port) => port.nodeId === nodeId).map(({ id }) => id),
  );
  return {
    ...network,
    nodes: network.nodes.map((node) => (node.id === nodeId ? next : node)),
    edges:
      patch.position === undefined
        ? network.edges
        : network.edges.map((edge) =>
            reanchor(edge, movedPorts, next.position),
          ),
  };
}

function reanchor(
  edge: NetworkEdge,
  movedPorts: ReadonlySet<string>,
  position: Point3D,
): NetworkEdge {
  const startMoved = movedPorts.has(edge.fromPortId);
  const endMoved = movedPorts.has(edge.toPortId);
  if (!startMoved && !endMoved) return edge;
  const path = edge.path.map((point, index) =>
    (startMoved && index === 0) || (endMoved && index === edge.path.length - 1)
      ? structuredClone(position)
      : point,
  );
  return { ...edge, path };
}

function addPort(
  network: TechnicalNetwork,
  port: NetworkPort,
): TechnicalNetwork {
  if (network.ports.some(({ id }) => id === port.id))
    throw new RangeError(`Le port ${port.id} existe déjà.`);
  return { ...network, ports: [...network.ports, structuredClone(port)] };
}

function addEdge(
  network: TechnicalNetwork,
  edge: NetworkEdge,
): TechnicalNetwork {
  if (network.edges.some(({ id }) => id === edge.id))
    throw new RangeError(`Le tronçon ${edge.id} existe déjà.`);
  return { ...network, edges: [...network.edges, structuredClone(edge)] };
}
