import {
  validateTechnicalNetwork,
  type NetworkEdge,
  type NetworkNode,
  type TechnicalNetwork,
} from '@house-technical-designer/core-domain';

export type VentilationSystemType =
  'SUPPLY' | 'EXTRACT' | 'BALANCED' | 'TRANSFER';
export type AirTerminalRole = 'SUPPLY' | 'EXTRACT' | 'TRANSFER';
export type VentilationNodeKind =
  | 'SOURCE'
  | 'TERMINAL'
  | 'JUNCTION'
  | 'FAN'
  | 'FILTER'
  | 'DAMPER'
  | 'HEAT_RECOVERY'
  | 'INTAKE'
  | 'EXHAUST';

export interface AirTerminal {
  readonly roomId: string;
  readonly role: AirTerminalRole;
  /** Design input only; regulatory targets belong to a selected Rule Pack. */
  readonly targetFlowM3h?: number;
  readonly pressureDropPa?: number;
}

export interface FanDefinition {
  readonly curve?: readonly {
    readonly flowM3h: number;
    readonly pressurePa: number;
  }[];
  readonly nominalPowerW?: number;
  readonly efficiency?: number;
}

export interface VentilationEquipment {
  readonly type: 'FILTER' | 'DAMPER' | 'HEAT_RECOVERY';
  readonly pressureDropPa?: number;
  readonly efficiency?: number;
  readonly catalogItemId?: string;
}

export interface VentilationNode extends NetworkNode {
  readonly kind: VentilationNodeKind;
  readonly terminal?: AirTerminal;
  readonly fan?: FanDefinition;
  readonly equipment?: VentilationEquipment;
}

export interface DuctProperties extends Readonly<Record<string, unknown>> {
  /** Length is deliberately absent: calculations derive it from the millimetre path. */
  readonly airRole: AirTerminalRole;
  readonly shape: 'ROUND' | 'RECTANGULAR';
  readonly diameterM?: number;
  readonly widthM?: number;
  readonly heightM?: number;
  readonly roughnessM?: number;
  readonly localLossCoefficient?: number;
}

export interface DuctSegment extends NetworkEdge {
  readonly kind: 'DUCT';
  readonly properties: DuctProperties;
}

export interface VentilationNetwork extends Omit<
  TechnicalNetwork,
  'discipline' | 'systemType' | 'nodes' | 'edges'
> {
  readonly discipline: 'VENTILATION';
  readonly systemType: VentilationSystemType;
  readonly nodes: readonly VentilationNode[];
  readonly edges: readonly DuctSegment[];
}

export interface VentilationDomainIssue {
  readonly code:
    | 'VENT_INVALID_NODE_CONFIGURATION'
    | 'VENT_INVALID_TERMINAL'
    | 'VENT_INVALID_DUCT'
    | 'VENT_UNKNOWN_DUCT_SECTION'
    | 'VENT_INVALID_FAN'
    | 'VENT_INVALID_EQUIPMENT';
  readonly path: string;
  readonly severity: 'ERROR' | 'WARNING';
  readonly message: string;
}

export function validateVentilationNetwork(
  network: VentilationNetwork,
): readonly VentilationDomainIssue[] {
  const issues: VentilationDomainIssue[] = [];
  network.nodes.forEach((node, index) => {
    validateNode(node, index, issues);
  });
  network.edges.forEach((duct, index) => {
    validateDuct(duct, index, issues);
  });
  return issues;
}

export function createVentilationNetwork(
  network: VentilationNetwork,
): VentilationNetwork {
  const genericIssues = validateTechnicalNetwork(network);
  const domainIssues = validateVentilationNetwork(network).filter(
    ({ severity }) => severity === 'ERROR',
  );
  if (genericIssues.length > 0 || domainIssues.length > 0)
    throw new RangeError(
      [...genericIssues, ...domainIssues]
        .map(({ path, message }) => `${path}: ${message}`)
        .join('; '),
    );
  return structuredClone(network);
}

function validateNode(
  node: VentilationNode,
  index: number,
  issues: VentilationDomainIssue[],
): void {
  const path = `nodes[${index}]`;
  const configurations = [node.terminal, node.fan, node.equipment].filter(
    (value) => value !== undefined,
  ).length;
  const expectedConfiguration =
    (node.kind === 'TERMINAL' && node.terminal !== undefined) ||
    (node.kind === 'FAN' && node.fan !== undefined) ||
    (isEquipmentKind(node.kind) && node.equipment?.type === node.kind);
  if (configurations > 1 || (configurations === 1 && !expectedConfiguration))
    issues.push(
      domainIssue(
        'VENT_INVALID_NODE_CONFIGURATION',
        path,
        'ERROR',
        `Node ${node.id} has properties inconsistent with kind ${node.kind}.`,
      ),
    );
  if (node.kind === 'TERMINAL') {
    if (
      node.terminal === undefined ||
      node.terminal.roomId.trim() === '' ||
      invalidOptionalPositive(node.terminal.targetFlowM3h) ||
      invalidOptionalNonNegative(node.terminal.pressureDropPa)
    )
      issues.push(
        domainIssue(
          'VENT_INVALID_TERMINAL',
          `${path}.terminal`,
          'ERROR',
          `Terminal data on node ${node.id} is missing or invalid.`,
        ),
      );
  }
  if (node.kind === 'FAN' && !validFan(node.fan))
    issues.push(
      domainIssue(
        'VENT_INVALID_FAN',
        `${path}.fan`,
        'ERROR',
        `Fan data on node ${node.id} is missing or invalid.`,
      ),
    );
  if (
    ['FILTER', 'DAMPER', 'HEAT_RECOVERY'].includes(node.kind) &&
    !validEquipment(node.equipment)
  )
    issues.push(
      domainIssue(
        'VENT_INVALID_EQUIPMENT',
        `${path}.equipment`,
        'ERROR',
        `Equipment data on node ${node.id} is missing or invalid.`,
      ),
    );
}

function validateDuct(
  duct: DuctSegment,
  index: number,
  issues: VentilationDomainIssue[],
): void {
  const properties = duct.properties;
  const path = `edges[${index}].properties`;
  if (
    invalidOptionalNonNegative(properties.roughnessM) ||
    invalidOptionalNonNegative(properties.localLossCoefficient)
  )
    issues.push(
      domainIssue(
        'VENT_INVALID_DUCT',
        path,
        'ERROR',
        `Duct ${duct.id} has invalid physical properties.`,
      ),
    );
  const sectionKnown =
    properties.shape === 'ROUND'
      ? properties.diameterM !== undefined
      : properties.widthM !== undefined && properties.heightM !== undefined;
  if (!sectionKnown)
    issues.push(
      domainIssue(
        'VENT_UNKNOWN_DUCT_SECTION',
        path,
        'WARNING',
        `Duct ${duct.id} section is unknown.`,
      ),
    );
  if (
    (properties.shape === 'ROUND' &&
      properties.diameterM !== undefined &&
      !positive(properties.diameterM)) ||
    (properties.shape === 'RECTANGULAR' &&
      ((properties.widthM !== undefined && !positive(properties.widthM)) ||
        (properties.heightM !== undefined && !positive(properties.heightM)))) ||
    (properties.shape === 'ROUND' &&
      (properties.widthM !== undefined || properties.heightM !== undefined)) ||
    (properties.shape === 'RECTANGULAR' && properties.diameterM !== undefined)
  )
    issues.push(
      domainIssue(
        'VENT_INVALID_DUCT',
        path,
        'ERROR',
        `Duct ${duct.id} dimensions do not match its shape.`,
      ),
    );
}

function isEquipmentKind(
  kind: VentilationNodeKind,
): kind is VentilationEquipment['type'] {
  return kind === 'FILTER' || kind === 'DAMPER' || kind === 'HEAT_RECOVERY';
}

function validFan(fan: FanDefinition | undefined): boolean {
  if (fan === undefined) return false;
  return (
    !invalidOptionalPositive(fan.nominalPowerW) &&
    (fan.efficiency === undefined || validRatio(fan.efficiency)) &&
    (fan.curve === undefined ||
      (fan.curve.length > 0 &&
        fan.curve.every(
          ({ flowM3h, pressurePa }) =>
            validNonNegative(flowM3h) && validNonNegative(pressurePa),
        ) &&
        fan.curve.every(
          ({ flowM3h }, index) =>
            index === 0 || flowM3h > fan.curve![index - 1]!.flowM3h,
        )))
  );
}

function validEquipment(equipment: VentilationEquipment | undefined): boolean {
  return (
    equipment !== undefined &&
    !invalidOptionalNonNegative(equipment.pressureDropPa) &&
    (equipment.efficiency === undefined || validRatio(equipment.efficiency)) &&
    (equipment.catalogItemId === undefined ||
      equipment.catalogItemId.trim() !== '')
  );
}

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function validNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function validRatio(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function invalidOptionalPositive(value: number | undefined): boolean {
  return value !== undefined && !positive(value);
}

function invalidOptionalNonNegative(value: number | undefined): boolean {
  return value !== undefined && !validNonNegative(value);
}

function domainIssue(
  code: VentilationDomainIssue['code'],
  path: string,
  severity: VentilationDomainIssue['severity'],
  message: string,
): VentilationDomainIssue {
  return { code, path, severity, message };
}
