import type {
  ObjectState,
  ScenePrimitive,
  SemanticRole,
} from '@house-technical-designer/drawing-engine';
import {
  metresToMillimetres,
  millimetres,
  millimetresToMetres,
  numericValue,
  metres,
} from '@house-technical-designer/units';
import type { PipeHydraulicResult } from './hydraulics.js';
import {
  validateWaterNetwork,
  type WaterDomainIssue,
  type WaterEdge,
  type WaterNetwork,
} from './water-domain.js';

export interface WaterPipeInspector {
  readonly edgeId: string;
  readonly networkType: WaterNetwork['systemType'];
  readonly materialId?: string;
  readonly lengthM: number;
  readonly internalDiameterM?: number;
  readonly internalDiameterMm?: number;
  readonly flowM3s?: number;
  readonly velocityMs?: number;
  readonly pressureLossPa?: number;
  readonly warnings: readonly string[];
}

export function createPlumbingScene(
  network: WaterNetwork,
  hydraulics: Readonly<Record<string, PipeHydraulicResult | undefined>> = {},
): readonly ScenePrimitive[] {
  const issues = validateWaterNetwork(network);
  return network.edges.map((edge, index) => {
    const result = hydraulics[edge.id];
    const edgeIssues = issues.filter(({ path }) =>
      path.startsWith(`edges[${index}]`),
    );
    return {
      id: `water:${network.id}:${edge.id}`,
      sourceObjectId: edge.id,
      semanticRole: waterRole(network.systemType),
      geometry: {
        kind: 'POLYLINE',
        polyline: {
          points: edge.path.map(({ x, y }) => ({ x, y })),
          closed: false,
        },
      },
      layer: `water.${network.systemType.toLowerCase()}`,
      zIndex: 40,
      discipline: 'WATER',
      state: pipeState(edgeIssues, result),
      metadata: pipeMetadata(network, edge, result),
    };
  });
}

export function createWaterPipeInspector(
  network: WaterNetwork,
  edgeId: string,
  hydraulics?: PipeHydraulicResult,
): WaterPipeInspector {
  const edgeIndex = network.edges.findIndex(({ id }) => id === edgeId);
  const edge = network.edges[edgeIndex];
  if (edge === undefined)
    throw new RangeError(`Water edge ${edgeId} does not exist`);
  const diameterM = edge.properties?.internalDiameterM;
  const warnings = [
    ...validateWaterNetwork(network)
      .filter(({ path }) => path.startsWith(`edges[${edgeIndex}]`))
      .map(({ message }) => message),
    ...(hydraulics?.warnings.map(({ message }) => message) ?? []),
  ];
  return {
    edgeId,
    networkType: network.systemType,
    lengthM: pathLengthM(edge),
    ...(edge.properties?.materialId === undefined
      ? {}
      : { materialId: edge.properties.materialId }),
    ...(diameterM === undefined
      ? {}
      : {
          internalDiameterM: diameterM,
          internalDiameterMm: numericValue(
            metresToMillimetres(metres(diameterM)),
          ),
        }),
    ...(hydraulics?.flowM3s === undefined
      ? {}
      : { flowM3s: hydraulics.flowM3s }),
    ...(hydraulics?.velocityMs === undefined
      ? {}
      : { velocityMs: hydraulics.velocityMs }),
    ...(hydraulics?.totalPressureLossPa === undefined
      ? {}
      : { pressureLossPa: hydraulics.totalPressureLossPa }),
    warnings,
  };
}

function waterRole(systemType: WaterNetwork['systemType']): SemanticRole {
  if (systemType === 'POTABLE_COLD') return 'WATER_COLD';
  if (systemType === 'DOMESTIC_HOT_WATER') return 'WATER_HOT';
  if (systemType === 'RECIRCULATION') return 'WATER_RECIRCULATION';
  return 'WATER_NON_POTABLE';
}

function pipeState(
  issues: readonly WaterDomainIssue[],
  hydraulics: PipeHydraulicResult | undefined,
): ObjectState {
  if (issues.some(({ severity }) => severity === 'ERROR')) return 'ERROR';
  if (issues.length > 0 || hydraulics?.status === 'PARTIAL') return 'WARNING';
  return 'NORMAL';
}

function pipeMetadata(
  network: WaterNetwork,
  edge: WaterEdge,
  hydraulics: PipeHydraulicResult | undefined,
): NonNullable<ScenePrimitive['metadata']> {
  return {
    networkId: network.id,
    systemType: network.systemType,
    lengthM: pathLengthM(edge),
    ...(edge.properties?.internalDiameterM === undefined
      ? {}
      : { internalDiameterM: edge.properties.internalDiameterM }),
    ...(edge.properties?.materialId === undefined
      ? {}
      : { materialId: edge.properties.materialId }),
    ...(hydraulics?.flowM3s === undefined
      ? {}
      : { flowM3s: hydraulics.flowM3s }),
    ...(hydraulics?.velocityMs === undefined
      ? {}
      : { velocityMs: hydraulics.velocityMs }),
    ...(hydraulics?.totalPressureLossPa === undefined
      ? {}
      : { pressureLossPa: hydraulics.totalPressureLossPa }),
  };
}

function pathLengthM(edge: WaterEdge): number {
  let totalMm = 0;
  for (let index = 1; index < edge.path.length; index += 1) {
    const first = edge.path[index - 1]!;
    const second = edge.path[index]!;
    totalMm += Math.hypot(
      second.x - first.x,
      second.y - first.y,
      second.z - first.z,
    );
  }
  return numericValue(millimetresToMetres(millimetres(totalMm)));
}
