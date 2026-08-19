import {
  createNetworkAnalysisOverlay,
  type AnalysisOverlay,
} from '@house-technical-designer/calculation-core';
import type {
  ObjectState,
  ScenePrimitive,
  SemanticRole,
} from '@house-technical-designer/drawing-engine';
import {
  electricalPathLengthM,
  type ElectricalCableResult,
  type ElectricalCircuitResult,
} from './electrical-calculations.js';
import {
  validateElectricalNetwork,
  type ElectricalCable,
  type ElectricalCircuit,
  type ElectricalNetwork,
  type ElectricalNodeKind,
} from './electrical-domain.js';

export type ElectricalOverlayMetric = 'CURRENT' | 'VOLTAGE_DROP';

export interface ElectricalCableInspector {
  readonly cableId: string;
  readonly circuitId: string;
  readonly circuitPurpose: ElectricalCircuit['purpose'];
  readonly lengthM: number;
  readonly conductorCount: number;
  readonly conductorMaterial?: ElectricalCable['properties']['conductorMaterial'];
  readonly conductorSectionMm2?: number;
  readonly currentA?: number;
  readonly voltageDropV?: number;
  readonly warnings: readonly string[];
}

export function createElectricalScene(
  network: ElectricalNetwork,
  results: readonly ElectricalCircuitResult[] = [],
): readonly ScenePrimitive[] {
  const circuits = new Map(
    network.circuits.map((circuit) => [circuit.id, circuit]),
  );
  const cableResults = new Map(
    results
      .flatMap((result) => result.cables)
      .map((result) => [result.cableId, result]),
  );
  const issues = validateElectricalNetwork(network);
  const cables: ScenePrimitive[] = network.edges.map((cable, index) => {
    const circuit = circuits.get(cable.properties.circuitId);
    const result = cableResults.get(cable.id);
    const cableIssues = issues.filter(({ path }) =>
      path.startsWith(`edges[${index}]`),
    );
    return {
      id: `electrical:${network.id}:cable:${cable.id}`,
      sourceObjectId: cable.id,
      semanticRole: circuitRole(circuit?.purpose ?? 'OTHER'),
      geometry: {
        kind: 'POLYLINE',
        polyline: {
          points: cable.path.map(({ x, y }) => ({ x, y })),
          closed: false,
        },
      },
      layer: `electrical.circuit.${cable.properties.circuitId}`,
      zIndex: 40,
      discipline: 'ELECTRICAL',
      state: objectState(cableIssues, result),
      metadata: {
        circuitId: cable.properties.circuitId,
        circuitPurpose: circuit?.purpose ?? 'OTHER',
        lengthM: electricalPathLengthM(cable.path),
        ...(result?.currentA === undefined
          ? {}
          : { currentA: result.currentA }),
        ...(result?.voltageDropV === undefined
          ? {}
          : { voltageDropV: result.voltageDropV }),
      },
    };
  });
  const symbols: ScenePrimitive[] = network.nodes.flatMap((node, index) =>
    node.kind === 'SOURCE'
      ? []
      : [
          {
            id: `electrical:${network.id}:symbol:${node.id}`,
            sourceObjectId: node.id,
            semanticRole: nodeRole(node.kind),
            geometry: {
              kind: 'POINT',
              point: { x: node.position.x, y: node.position.y },
            },
            layer: `electrical.symbol.${node.kind.toLowerCase()}`,
            zIndex: 50,
            discipline: 'ELECTRICAL',
            state: objectState(
              issues.filter(({ path }) => path.startsWith(`nodes[${index}]`)),
            ),
            metadata: { symbolKind: node.kind },
          },
        ],
  );
  return [...cables, ...symbols];
}

export function createElectricalCircuitOverlay(
  id: string,
  network: ElectricalNetwork,
): AnalysisOverlay {
  if (id.trim() === '') throw new TypeError('Overlay ID must not be empty');
  const ordered = [...network.edges].sort((first, second) =>
    first.id.localeCompare(second.id),
  );
  return {
    id,
    metric: 'electrical-circuit',
    unit: 'circuit-id',
    values: Object.fromEntries(
      ordered.map((cable) => [cable.id, cable.properties.circuitId]),
    ),
    states: Object.fromEntries(ordered.map((cable) => [cable.id, 'NORMAL'])),
  };
}

export function createElectricalNumericOverlay(
  id: string,
  metric: ElectricalOverlayMetric,
  results: readonly ElectricalCircuitResult[],
): AnalysisOverlay {
  const cables = results.flatMap((result) => result.cables);
  return createNetworkAnalysisOverlay(
    id,
    metric === 'CURRENT' ? 'electrical-current' : 'voltage-drop',
    metric === 'CURRENT' ? 'A' : 'V',
    cables.map((cable) => {
      const value = metric === 'CURRENT' ? cable.currentA : cable.voltageDropV;
      return {
        objectId: cable.cableId,
        ...(value === undefined ? {} : { value }),
        state: value === undefined ? 'UNKNOWN' : 'NORMAL',
      };
    }),
  );
}

export function createElectricalCableInspector(
  network: ElectricalNetwork,
  cableId: string,
  result?: ElectricalCableResult,
): ElectricalCableInspector {
  const index = network.edges.findIndex(({ id }) => id === cableId);
  const cable = network.edges[index];
  if (cable === undefined)
    throw new RangeError(`Electrical cable ${cableId} does not exist`);
  const circuit = network.circuits.find(
    ({ id }) => id === cable.properties.circuitId,
  );
  if (circuit === undefined)
    throw new RangeError(
      `Circuit ${cable.properties.circuitId} does not exist`,
    );
  return {
    cableId,
    circuitId: circuit.id,
    circuitPurpose: circuit.purpose,
    lengthM: electricalPathLengthM(cable.path),
    conductorCount: cable.properties.conductorCount,
    ...(cable.properties.conductorMaterial === undefined
      ? {}
      : { conductorMaterial: cable.properties.conductorMaterial }),
    ...(cable.properties.conductorSectionMm2 === undefined
      ? {}
      : { conductorSectionMm2: cable.properties.conductorSectionMm2 }),
    ...(result?.currentA === undefined ? {} : { currentA: result.currentA }),
    ...(result?.voltageDropV === undefined
      ? {}
      : { voltageDropV: result.voltageDropV }),
    warnings: [
      ...validateElectricalNetwork(network)
        .filter(({ path }) => path.startsWith(`edges[${index}]`))
        .map(({ message }) => message),
      ...(result?.warnings.map(({ message }) => message) ?? []),
    ],
  };
}

function circuitRole(purpose: ElectricalCircuit['purpose']): SemanticRole {
  if (purpose === 'LIGHTING') return 'ELECTRICAL_LIGHTING';
  if (purpose === 'CONTROL') return 'ELECTRICAL_CONTROL';
  if (purpose === 'PV') return 'ELECTRICAL_PV';
  return 'ELECTRICAL_POWER';
}

function nodeRole(kind: ElectricalNodeKind): SemanticRole {
  if (kind === 'LUMINAIRE') return 'ELECTRICAL_LIGHTING';
  if (kind === 'SWITCH') return 'ELECTRICAL_CONTROL';
  if (kind === 'PV') return 'ELECTRICAL_PV';
  return 'ELECTRICAL_POWER';
}

function objectState(
  issues: readonly { readonly severity: 'ERROR' | 'WARNING' }[],
  result?: ElectricalCableResult,
): ObjectState {
  if (issues.some(({ severity }) => severity === 'ERROR')) return 'ERROR';
  if (issues.length > 0 || result?.status === 'PARTIAL') return 'WARNING';
  return 'NORMAL';
}
