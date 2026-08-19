import {
  createNetworkAnalysisOverlay,
  type AnalysisObjectState,
  type AnalysisOverlay,
} from '@house-technical-designer/calculation-core';
import type {
  ObjectState,
  ScenePrimitive,
  SemanticRole,
} from '@house-technical-designer/drawing-engine';
import { ductPathLengthM, type DuctAirflowResult } from './airflow.js';
import {
  validateVentilationNetwork,
  type AirTerminalRole,
  type DuctSegment,
  type VentilationNetwork,
} from './ventilation-domain.js';

export type VentilationOverlayMetric = 'AIRFLOW' | 'VELOCITY' | 'PRESSURE_LOSS';

export interface VentilationDuctInspector {
  readonly ductId: string;
  readonly airRole: AirTerminalRole;
  readonly shape: DuctSegment['properties']['shape'];
  readonly lengthM: number;
  readonly diameterM?: number;
  readonly widthM?: number;
  readonly heightM?: number;
  readonly flowM3h?: number;
  readonly velocityMs?: number;
  readonly pressureLossPa?: number;
  readonly warnings: readonly string[];
}

export function createVentilationScene(
  network: VentilationNetwork,
  results: Readonly<Record<string, DuctAirflowResult | undefined>> = {},
): readonly ScenePrimitive[] {
  const issues = validateVentilationNetwork(network);
  return network.edges.map((duct, index) => {
    const result = results[duct.id];
    const ductIssues = issues.filter(({ path }) =>
      path.startsWith(`edges[${index}]`),
    );
    return {
      id: `ventilation:${network.id}:${duct.id}`,
      sourceObjectId: duct.id,
      semanticRole: roleForAir(duct.properties.airRole),
      geometry: {
        kind: 'POLYLINE',
        polyline: {
          points: duct.path.map(({ x, y }) => ({ x, y })),
          closed: false,
        },
      },
      layer: `ventilation.${duct.properties.airRole.toLowerCase()}`,
      zIndex: 40,
      discipline: 'VENTILATION',
      state: ductState(ductIssues, result),
      metadata: {
        networkId: network.id,
        airRole: duct.properties.airRole,
        shape: duct.properties.shape,
        ...(result === undefined ? {} : resultMetadata(result)),
      },
    };
  });
}

export function createVentilationOverlay(
  id: string,
  metric: VentilationOverlayMetric,
  results: readonly DuctAirflowResult[],
): AnalysisOverlay {
  const definition = metricDefinition(metric);
  return createNetworkAnalysisOverlay(
    id,
    definition.metric,
    definition.unit,
    results.map((result) => {
      const value = definition.value(result);
      return {
        objectId: result.ductId,
        ...(value === undefined ? {} : { value }),
        state: value === undefined ? 'UNKNOWN' : metricState(result, metric),
      };
    }),
  );
}

export function createVentilationDuctInspector(
  network: VentilationNetwork,
  ductId: string,
  result?: DuctAirflowResult,
): VentilationDuctInspector {
  const index = network.edges.findIndex(({ id }) => id === ductId);
  const duct = network.edges[index];
  if (duct === undefined)
    throw new RangeError(`Ventilation duct ${ductId} does not exist`);
  const properties = duct.properties;
  return {
    ductId,
    airRole: properties.airRole,
    shape: properties.shape,
    lengthM: ductPathLengthM(duct.path),
    ...(properties.diameterM === undefined
      ? {}
      : { diameterM: properties.diameterM }),
    ...(properties.widthM === undefined ? {} : { widthM: properties.widthM }),
    ...(properties.heightM === undefined
      ? {}
      : { heightM: properties.heightM }),
    ...(result?.flowM3h === undefined ? {} : { flowM3h: result.flowM3h }),
    ...(result?.velocityMs === undefined
      ? {}
      : { velocityMs: result.velocityMs }),
    ...(result?.totalPressureLossPa === undefined
      ? {}
      : { pressureLossPa: result.totalPressureLossPa }),
    warnings: [
      ...validateVentilationNetwork(network)
        .filter(({ path }) => path.startsWith(`edges[${index}]`))
        .map(({ message }) => message),
      ...(result?.warnings.map(({ message }) => message) ?? []),
    ],
  };
}

function metricDefinition(metric: VentilationOverlayMetric): {
  readonly metric: string;
  readonly unit: string;
  readonly value: (result: DuctAirflowResult) => number | undefined;
} {
  if (metric === 'AIRFLOW')
    return { metric: 'airflow', unit: 'm3/h', value: ({ flowM3h }) => flowM3h };
  if (metric === 'VELOCITY')
    return {
      metric: 'air-velocity',
      unit: 'm/s',
      value: ({ velocityMs }) => velocityMs,
    };
  return {
    metric: 'pressure-loss',
    unit: 'Pa',
    value: ({ totalPressureLossPa }) => totalPressureLossPa,
  };
}

function metricState(
  result: DuctAirflowResult,
  metric: VentilationOverlayMetric,
): AnalysisObjectState {
  if (metric === 'PRESSURE_LOSS' && result.status === 'PARTIAL')
    return 'WARNING';
  return 'NORMAL';
}

function ductState(
  issues: readonly { readonly severity: 'ERROR' | 'WARNING' }[],
  result: DuctAirflowResult | undefined,
): ObjectState {
  if (issues.some(({ severity }) => severity === 'ERROR')) return 'ERROR';
  if (issues.length > 0 || result?.status === 'PARTIAL') return 'WARNING';
  return 'NORMAL';
}

function roleForAir(role: AirTerminalRole): SemanticRole {
  if (role === 'SUPPLY') return 'VENT_SUPPLY';
  if (role === 'EXTRACT') return 'VENT_EXHAUST';
  return 'VENT_TRANSFER';
}

function resultMetadata(
  result: DuctAirflowResult,
): NonNullable<ScenePrimitive['metadata']> {
  return {
    lengthM: result.lengthM,
    ...(result.flowM3h === undefined ? {} : { flowM3h: result.flowM3h }),
    ...(result.velocityMs === undefined
      ? {}
      : { velocityMs: result.velocityMs }),
    ...(result.totalPressureLossPa === undefined
      ? {}
      : { pressureLossPa: result.totalPressureLossPa }),
  };
}
