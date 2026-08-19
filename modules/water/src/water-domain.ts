import {
  validateTechnicalNetwork,
  type NetworkEdge,
  type NetworkNode,
  type TechnicalNetwork,
} from '@house-technical-designer/core-domain';

export type WaterSystemType =
  | 'POTABLE_COLD'
  | 'DOMESTIC_HOT_WATER'
  | 'RECIRCULATION'
  | 'NON_POTABLE'
  | 'RAINWATER'
  | 'OTHER';

export type WaterQuality = 'POTABLE' | 'NON_POTABLE' | 'UNSPECIFIED';

export interface WaterFixtureProperties {
  readonly fixtureType: string;
  readonly designFlowLps?: number;
  readonly hotWaterFraction?: number;
  readonly minimumPressurePa?: number;
}

export interface WaterNode extends NetworkNode {
  readonly fixture?: WaterFixtureProperties;
}

export interface WaterPipeProperties extends Readonly<Record<string, unknown>> {
  readonly internalDiameterM?: number;
  readonly materialId?: string;
  readonly roughnessM?: number;
  readonly localLossCoefficient?: number;
  readonly insulationAssemblyId?: string;
}

export interface WaterEdge extends NetworkEdge {
  readonly kind: 'PIPE';
  readonly properties?: WaterPipeProperties;
}

export interface WaterNetwork extends Omit<
  TechnicalNetwork,
  'discipline' | 'systemType' | 'nodes' | 'edges'
> {
  readonly discipline: 'WATER' | 'RAINWATER';
  readonly systemType: WaterSystemType;
  readonly nodes: readonly WaterNode[];
  readonly edges: readonly WaterEdge[];
}

export type WaterDomainIssueCode =
  | 'WATER_INVALID_NETWORK_TYPE'
  | 'WATER_INVALID_DIAMETER'
  | 'WATER_UNKNOWN_PIPE_PROPERTIES'
  | 'WATER_INVALID_FIXTURE'
  | 'WATER_CROSS_CONNECTION_RISK';

export interface WaterDomainIssue {
  readonly code: WaterDomainIssueCode;
  readonly path: string;
  readonly severity: 'ERROR' | 'WARNING';
  readonly message: string;
}

export function waterQuality(systemType: WaterSystemType): WaterQuality {
  if (
    systemType === 'POTABLE_COLD' ||
    systemType === 'DOMESTIC_HOT_WATER' ||
    systemType === 'RECIRCULATION'
  )
    return 'POTABLE';
  if (systemType === 'NON_POTABLE' || systemType === 'RAINWATER')
    return 'NON_POTABLE';
  return 'UNSPECIFIED';
}

export function validateWaterNetwork(
  network: WaterNetwork,
): readonly WaterDomainIssue[] {
  const issues: WaterDomainIssue[] = [];
  if (
    (network.systemType === 'RAINWATER' &&
      network.discipline !== 'RAINWATER') ||
    (network.systemType !== 'RAINWATER' && network.discipline !== 'WATER')
  )
    issues.push({
      code: 'WATER_INVALID_NETWORK_TYPE',
      path: 'discipline',
      severity: 'ERROR',
      message: `Discipline ${network.discipline} is inconsistent with ${network.systemType}.`,
    });
  for (const [index, edge] of network.edges.entries()) {
    const diameter = edge.properties?.internalDiameterM;
    if (diameter === undefined)
      issues.push({
        code: 'WATER_UNKNOWN_PIPE_PROPERTIES',
        path: `edges[${index}].properties.internalDiameterM`,
        severity: 'WARNING',
        message: `Pipe ${edge.id} has an unknown internal diameter.`,
      });
    else if (!Number.isFinite(diameter) || diameter <= 0)
      issues.push({
        code: 'WATER_INVALID_DIAMETER',
        path: `edges[${index}].properties.internalDiameterM`,
        severity: 'ERROR',
        message: `Pipe ${edge.id} internal diameter must be finite and positive.`,
      });
    if (edge.properties?.materialId === undefined)
      issues.push({
        code: 'WATER_UNKNOWN_PIPE_PROPERTIES',
        path: `edges[${index}].properties.materialId`,
        severity: 'WARNING',
        message: `Pipe ${edge.id} material is unknown.`,
      });
  }
  for (const [index, node] of network.nodes.entries()) {
    const fixture = node.fixture;
    if (fixture === undefined) continue;
    if (
      fixture.fixtureType.trim() === '' ||
      invalidOptionalPositive(fixture.designFlowLps) ||
      invalidOptionalNonNegative(fixture.minimumPressurePa) ||
      (fixture.hotWaterFraction !== undefined &&
        (!Number.isFinite(fixture.hotWaterFraction) ||
          fixture.hotWaterFraction < 0 ||
          fixture.hotWaterFraction > 1))
    )
      issues.push({
        code: 'WATER_INVALID_FIXTURE',
        path: `nodes[${index}].fixture`,
        severity: 'ERROR',
        message: `Fixture properties on node ${node.id} are invalid.`,
      });
  }
  return issues;
}

/** Finds explicitly shared hosted objects; it does not infer or invent plumbing links. */
export function detectWaterCrossConnectionRisks(
  networks: readonly WaterNetwork[],
): readonly WaterDomainIssue[] {
  const byHost = new Map<
    string,
    Array<{ networkId: string; quality: WaterQuality }>
  >();
  for (const network of networks) {
    const quality = waterQuality(network.systemType);
    if (quality === 'UNSPECIFIED') continue;
    for (const node of network.nodes) {
      if (node.hostObjectId === undefined) continue;
      const entries = byHost.get(node.hostObjectId) ?? [];
      entries.push({ networkId: network.id, quality });
      byHost.set(node.hostObjectId, entries);
    }
  }
  const issues: WaterDomainIssue[] = [];
  for (const [hostObjectId, entries] of byHost) {
    const qualities = new Set(entries.map(({ quality }) => quality));
    if (qualities.has('POTABLE') && qualities.has('NON_POTABLE'))
      issues.push({
        code: 'WATER_CROSS_CONNECTION_RISK',
        path: `hostObjects/${hostObjectId}`,
        severity: 'WARNING',
        message: `Hosted object ${hostObjectId} is connected to potable and non-potable networks; verify physical separation.`,
      });
  }
  return issues.sort((first, second) => first.path.localeCompare(second.path));
}

export function createWaterNetwork(network: WaterNetwork): WaterNetwork {
  const genericIssues = validateTechnicalNetwork(network);
  const waterIssues = validateWaterNetwork(network).filter(
    ({ severity }) => severity === 'ERROR',
  );
  if (genericIssues.length > 0 || waterIssues.length > 0)
    throw new RangeError(
      [
        ...genericIssues.map(({ path, message }) => `${path}: ${message}`),
        ...waterIssues.map(({ path, message }) => `${path}: ${message}`),
      ].join('; '),
    );
  return structuredClone(network);
}

function invalidOptionalPositive(value: number | undefined): boolean {
  return value !== undefined && (!Number.isFinite(value) || value <= 0);
}

function invalidOptionalNonNegative(value: number | undefined): boolean {
  return value !== undefined && (!Number.isFinite(value) || value < 0);
}
