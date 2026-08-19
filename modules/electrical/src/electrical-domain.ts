import {
  validateTechnicalNetwork,
  type NetworkEdge,
  type NetworkNode,
  type TechnicalNetwork,
} from '@house-technical-designer/core-domain';

export type ElectricalSystemType = 'AC' | 'DC' | 'MIXED';
export type VoltageReference = 'PHASE_NEUTRAL' | 'PHASE_PHASE' | 'DC';
export type ElectricalNodeKind =
  | 'SOURCE'
  | 'BOARD'
  | 'PROTECTIVE_DEVICE'
  | 'OUTLET'
  | 'SWITCH'
  | 'LUMINAIRE'
  | 'FIXED_LOAD'
  | 'PV'
  | 'BATTERY'
  | 'EV';

export interface DistributionBoard {
  readonly boardId: string;
  readonly name: string;
  readonly phaseCount: 1 | 3;
}

export interface ElectricalLoad {
  readonly loadId: string;
  readonly name: string;
  readonly activePowerW?: number;
  readonly apparentPowerVA?: number;
  readonly powerFactor?: number;
  readonly demandFactor?: number;
  readonly startingCurrentA?: number;
}

export interface ProtectiveDevice {
  readonly protectiveDeviceId: string;
  readonly type:
    'BREAKER' | 'FUSE' | 'RCD' | 'SURGE_PROTECTION' | 'DISCONNECT' | 'OTHER';
  readonly catalogItemId?: string;
}

export interface ElectricalNode extends NetworkNode {
  readonly kind: ElectricalNodeKind;
  readonly board?: DistributionBoard;
  readonly load?: ElectricalLoad;
  readonly protectiveDevice?: ProtectiveDevice;
}

export interface ElectricalCircuit {
  readonly id: string;
  readonly purpose:
    'POWER' | 'LIGHTING' | 'CONTROL' | 'PV' | 'STORAGE' | 'EV' | 'OTHER';
  readonly boardId: string;
  readonly voltageV: number;
  readonly voltageReference: VoltageReference;
  readonly phases: 1 | 3;
  readonly conductorSectionMm2?: number;
  readonly loadIds: readonly string[];
  readonly protectiveDeviceId?: string;
}

export interface CableProperties extends Readonly<Record<string, unknown>> {
  readonly circuitId: string;
  readonly conductorCount: number;
  readonly conductorMaterial?: 'COPPER' | 'ALUMINIUM';
  readonly conductorSectionMm2?: number;
  readonly insulationCatalogItemId?: string;
}

export interface ElectricalCable extends NetworkEdge {
  readonly kind: 'CABLE';
  readonly properties: CableProperties;
}

export interface ElectricalNetwork extends Omit<
  TechnicalNetwork,
  'discipline' | 'systemType' | 'nodes' | 'edges'
> {
  readonly discipline: 'ELECTRICAL';
  readonly systemType: ElectricalSystemType;
  readonly nodes: readonly ElectricalNode[];
  readonly edges: readonly ElectricalCable[];
  readonly circuits: readonly ElectricalCircuit[];
}

export interface ElectricalDomainIssue {
  readonly code:
    | 'ELEC_INVALID_NODE_CONFIGURATION'
    | 'ELEC_INVALID_BOARD'
    | 'ELEC_INVALID_LOAD'
    | 'ELEC_INVALID_PROTECTIVE_DEVICE'
    | 'ELEC_INVALID_CIRCUIT'
    | 'ELEC_DUPLICATE_BUSINESS_ID'
    | 'ELEC_MISSING_REFERENCE'
    | 'ELEC_INVALID_CABLE';
  readonly path: string;
  readonly severity: 'ERROR' | 'WARNING';
  readonly message: string;
}

export function validateElectricalNetwork(
  network: ElectricalNetwork,
): readonly ElectricalDomainIssue[] {
  const issues: ElectricalDomainIssue[] = [];
  const boardIds = new Set<string>();
  const loadIds = new Set<string>();
  const protectiveDeviceIds = new Set<string>();
  network.nodes.forEach((node, index) => {
    validateNode(node, index, boardIds, loadIds, protectiveDeviceIds, issues);
  });
  const circuitIds = new Set<string>();
  network.circuits.forEach((circuit, index) => {
    const path = `circuits[${index}]`;
    if (circuitIds.has(circuit.id))
      issues.push(
        issue(
          'ELEC_DUPLICATE_BUSINESS_ID',
          `${path}.id`,
          'ERROR',
          `Duplicate circuit ID ${circuit.id}.`,
        ),
      );
    circuitIds.add(circuit.id);
    if (
      circuit.id.trim() === '' ||
      !positive(circuit.voltageV) ||
      (circuit.conductorSectionMm2 !== undefined &&
        !positive(circuit.conductorSectionMm2)) ||
      new Set(circuit.loadIds).size !== circuit.loadIds.length
    )
      issues.push(
        issue(
          'ELEC_INVALID_CIRCUIT',
          path,
          'ERROR',
          `Circuit ${circuit.id} has invalid voltage, phase, section, or load data.`,
        ),
      );
    if (!boardIds.has(circuit.boardId))
      issues.push(
        missing(`${path}.boardId`, `Board ${circuit.boardId} does not exist.`),
      );
    circuit.loadIds.forEach((loadId) => {
      if (!loadIds.has(loadId))
        issues.push(
          missing(`${path}.loadIds`, `Load ${loadId} does not exist.`),
        );
    });
    if (
      circuit.protectiveDeviceId !== undefined &&
      !protectiveDeviceIds.has(circuit.protectiveDeviceId)
    )
      issues.push(
        missing(
          `${path}.protectiveDeviceId`,
          `Protective device ${circuit.protectiveDeviceId} does not exist.`,
        ),
      );
  });
  network.edges.forEach((cable, index) => {
    const properties = cable.properties;
    const path = `edges[${index}].properties`;
    if (
      properties.circuitId.trim() === '' ||
      !Number.isInteger(properties.conductorCount) ||
      properties.conductorCount <= 0 ||
      (properties.conductorSectionMm2 !== undefined &&
        !positive(properties.conductorSectionMm2)) ||
      (properties.insulationCatalogItemId !== undefined &&
        properties.insulationCatalogItemId.trim() === '')
    )
      issues.push(
        issue(
          'ELEC_INVALID_CABLE',
          path,
          'ERROR',
          `Cable ${cable.id} has invalid conductor data.`,
        ),
      );
    if (!circuitIds.has(properties.circuitId))
      issues.push(
        missing(path, `Circuit ${properties.circuitId} does not exist.`),
      );
  });
  return issues;
}

export function createElectricalNetwork(
  network: ElectricalNetwork,
): ElectricalNetwork {
  const issues = [
    ...validateTechnicalNetwork(network),
    ...validateElectricalNetwork(network).filter(
      ({ severity }) => severity === 'ERROR',
    ),
  ];
  if (issues.length > 0)
    throw new RangeError(
      issues.map(({ path, message }) => `${path}: ${message}`).join('; '),
    );
  return structuredClone(network);
}

function validateNode(
  node: ElectricalNode,
  index: number,
  boardIds: Set<string>,
  loadIds: Set<string>,
  protectiveDeviceIds: Set<string>,
  issues: ElectricalDomainIssue[],
): void {
  const path = `nodes[${index}]`;
  const configurations = [node.board, node.load, node.protectiveDevice].filter(
    (value) => value !== undefined,
  );
  const expected =
    (node.kind === 'BOARD' && node.board !== undefined) ||
    (isLoadKind(node.kind) && node.load !== undefined) ||
    (node.kind === 'PROTECTIVE_DEVICE' && node.protectiveDevice !== undefined);
  if (configurations.length > 1 || (configurations.length === 1 && !expected))
    issues.push(
      issue(
        'ELEC_INVALID_NODE_CONFIGURATION',
        path,
        'ERROR',
        `Node ${node.id} properties do not match kind ${node.kind}.`,
      ),
    );
  if (node.kind === 'BOARD') {
    if (node.board === undefined || node.board.name.trim() === '')
      issues.push(
        issue(
          'ELEC_INVALID_BOARD',
          `${path}.board`,
          'ERROR',
          `Board data on node ${node.id} is missing or invalid.`,
        ),
      );
    else
      addBusinessId(
        node.board.boardId,
        `${path}.board.boardId`,
        boardIds,
        issues,
      );
  }
  if (isLoadKind(node.kind)) {
    if (node.load === undefined || !validLoad(node.load))
      issues.push(
        issue(
          'ELEC_INVALID_LOAD',
          `${path}.load`,
          'ERROR',
          `Load data on node ${node.id} is missing or invalid.`,
        ),
      );
    else
      addBusinessId(node.load.loadId, `${path}.load.loadId`, loadIds, issues);
  }
  if (node.kind === 'PROTECTIVE_DEVICE') {
    if (
      node.protectiveDevice === undefined ||
      (node.protectiveDevice.catalogItemId !== undefined &&
        node.protectiveDevice.catalogItemId.trim() === '')
    )
      issues.push(
        issue(
          'ELEC_INVALID_PROTECTIVE_DEVICE',
          `${path}.protectiveDevice`,
          'ERROR',
          `Protective device on node ${node.id} is missing.`,
        ),
      );
    else
      addBusinessId(
        node.protectiveDevice.protectiveDeviceId,
        `${path}.protectiveDevice.protectiveDeviceId`,
        protectiveDeviceIds,
        issues,
      );
  }
}

function validLoad(load: ElectricalLoad): boolean {
  return (
    load.loadId.trim() !== '' &&
    load.name.trim() !== '' &&
    validOptionalNonNegative(load.activePowerW) &&
    validOptionalNonNegative(load.apparentPowerVA) &&
    validOptionalNonNegative(load.startingCurrentA) &&
    validOptionalPositiveRatio(load.powerFactor) &&
    validOptionalRatio(load.demandFactor)
  );
}

function isLoadKind(kind: ElectricalNodeKind): boolean {
  return ['OUTLET', 'LUMINAIRE', 'FIXED_LOAD', 'PV', 'BATTERY', 'EV'].includes(
    kind,
  );
}

function addBusinessId(
  id: string,
  path: string,
  ids: Set<string>,
  issues: ElectricalDomainIssue[],
): void {
  if (id.trim() === '' || ids.has(id))
    issues.push(
      issue(
        id.trim() === ''
          ? 'ELEC_INVALID_NODE_CONFIGURATION'
          : 'ELEC_DUPLICATE_BUSINESS_ID',
        path,
        'ERROR',
        id.trim() === ''
          ? 'Business ID must not be empty.'
          : `Duplicate ID ${id}.`,
      ),
    );
  ids.add(id);
}

function validOptionalNonNegative(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value >= 0);
}

function validOptionalRatio(value: number | undefined): boolean {
  return (
    value === undefined || (Number.isFinite(value) && value >= 0 && value <= 1)
  );
}

function validOptionalPositiveRatio(value: number | undefined): boolean {
  return (
    value === undefined || (Number.isFinite(value) && value > 0 && value <= 1)
  );
}

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function missing(path: string, message: string): ElectricalDomainIssue {
  return issue('ELEC_MISSING_REFERENCE', path, 'ERROR', message);
}

function issue(
  code: ElectricalDomainIssue['code'],
  path: string,
  severity: ElectricalDomainIssue['severity'],
  message: string,
): ElectricalDomainIssue {
  return { code, path, severity, message };
}
