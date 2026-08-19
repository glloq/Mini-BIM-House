import { describe, expect, it } from 'vitest';
import { calculateElectricalCircuit } from './electrical-calculations.js';
import type { ElectricalNetwork } from './electrical-domain.js';
import {
  createElectricalCableInspector,
  createElectricalCircuitOverlay,
  createElectricalNumericOverlay,
  createElectricalScene,
} from './electrical-view.js';

const network: ElectricalNetwork = {
  id: 'lighting-network',
  discipline: 'ELECTRICAL',
  systemType: 'AC',
  nodes: [
    { id: 'source', kind: 'SOURCE', position: { x: 0, y: 0, z: 0 } },
    {
      id: 'board',
      kind: 'BOARD',
      position: { x: 0, y: 0, z: 1_500 },
      board: { boardId: 'main', name: 'Main board', phaseCount: 1 },
    },
    {
      id: 'light',
      kind: 'LUMINAIRE',
      position: { x: 3_000, y: 4_000, z: 2_500 },
      load: {
        loadId: 'light-load',
        name: 'Light',
        activePowerW: 100,
        demandFactor: 1,
        powerFactor: 1,
      },
    },
  ],
  ports: [
    { id: 'source-out', nodeId: 'source', role: 'POWER', direction: 'OUT' },
    { id: 'board-in', nodeId: 'board', role: 'POWER', direction: 'IN' },
    { id: 'board-out', nodeId: 'board', role: 'POWER', direction: 'OUT' },
    { id: 'light-in', nodeId: 'light', role: 'POWER', direction: 'IN' },
  ],
  edges: [
    {
      id: 'service',
      kind: 'CABLE',
      fromPortId: 'source-out',
      toPortId: 'board-in',
      path: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 1_500 },
      ],
      properties: { circuitId: 'lighting', conductorCount: 3 },
    },
    {
      id: 'lighting-cable',
      kind: 'CABLE',
      fromPortId: 'board-out',
      toPortId: 'light-in',
      path: [
        { x: 0, y: 0, z: 1_500 },
        { x: 3_000, y: 4_000, z: 2_500 },
      ],
      properties: {
        circuitId: 'lighting',
        conductorCount: 3,
        conductorMaterial: 'COPPER',
        conductorSectionMm2: 1.5,
      },
    },
  ],
  circuits: [
    {
      id: 'lighting',
      purpose: 'LIGHTING',
      boardId: 'main',
      voltageV: 230,
      voltageReference: 'PHASE_NEUTRAL',
      phases: 1,
      loadIds: ['light-load'],
    },
  ],
};

const calculation = calculateElectricalCircuit({
  circuit: network.circuits[0]!,
  loads: [network.nodes[2]!.load!],
  cables: network.edges.map((cable) => ({
    cable,
    conductorResistanceOhmPerM: 0.012,
  })),
});

describe('electrical plan, overlays, and inspector', () => {
  it('projects cables and symbols with semantic lighting roles', () => {
    const scene = createElectricalScene(network, [calculation]);
    expect(
      scene.find(({ sourceObjectId }) => sourceObjectId === 'lighting-cable'),
    ).toMatchObject({
      semanticRole: 'ELECTRICAL_LIGHTING',
      discipline: 'ELECTRICAL',
      geometry: { kind: 'POLYLINE' },
    });
    expect(
      scene.find(({ sourceObjectId }) => sourceObjectId === 'light'),
    ).toMatchObject({
      semanticRole: 'ELECTRICAL_LIGHTING',
      geometry: { kind: 'POINT', point: { x: 3_000, y: 4_000 } },
      metadata: { symbolKind: 'LUMINAIRE' },
    });
  });

  it('creates categorical circuit and unit-bearing numeric overlays', () => {
    expect(createElectricalCircuitOverlay('circuits', network)).toMatchObject({
      metric: 'electrical-circuit',
      unit: 'circuit-id',
      values: { service: 'lighting', 'lighting-cable': 'lighting' },
    });
    expect(
      createElectricalNumericOverlay('current', 'CURRENT', [calculation]),
    ).toMatchObject({
      unit: 'A',
      values: { service: calculation.designCurrentA },
    });
    expect(
      createElectricalNumericOverlay('drop', 'VOLTAGE_DROP', [calculation]),
    ).toMatchObject({
      unit: 'V',
      values: { 'lighting-cable': calculation.cables[1]!.voltageDropV },
    });
  });

  it('keeps unavailable numeric results UNKNOWN rather than zero', () => {
    const partial = calculateElectricalCircuit({
      circuit: network.circuits[0]!,
      loads: [network.nodes[2]!.load!],
      cables: network.edges.map((cable) => ({ cable })),
    });
    expect(
      createElectricalNumericOverlay('drop', 'VOLTAGE_DROP', [partial]),
    ).toMatchObject({
      values: { service: null, 'lighting-cable': null },
      states: { service: 'UNKNOWN', 'lighting-cable': 'UNKNOWN' },
    });
  });

  it('builds a cable inspector from source geometry and derived results', () => {
    expect(
      createElectricalCableInspector(
        network,
        'lighting-cable',
        calculation.cables[1],
      ),
    ).toMatchObject({
      circuitId: 'lighting',
      circuitPurpose: 'LIGHTING',
      conductorMaterial: 'COPPER',
      conductorSectionMm2: 1.5,
      warnings: [],
    });
  });
});
