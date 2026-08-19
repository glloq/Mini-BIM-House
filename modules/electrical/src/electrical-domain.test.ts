import { describe, expect, it } from 'vitest';
import {
  createElectricalNetwork,
  validateElectricalNetwork,
  type ElectricalNetwork,
} from './electrical-domain.js';

const network: ElectricalNetwork = {
  id: 'house-electrical',
  discipline: 'ELECTRICAL',
  systemType: 'AC',
  nodes: [
    { id: 'service', kind: 'SOURCE', position: { x: 0, y: 0, z: 0 } },
    {
      id: 'board-node',
      kind: 'BOARD',
      position: { x: 500, y: 0, z: 1_500 },
      board: { boardId: 'main-board', name: 'Main board', phaseCount: 1 },
    },
    {
      id: 'load-node',
      kind: 'FIXED_LOAD',
      position: { x: 5_000, y: 0, z: 500 },
      load: {
        loadId: 'heater',
        name: 'Heater',
        activePowerW: 2_300,
        powerFactor: 1,
        demandFactor: 0.8,
      },
    },
    {
      id: 'breaker-node',
      kind: 'PROTECTIVE_DEVICE',
      position: { x: 500, y: 0, z: 1_500 },
      protectiveDevice: {
        protectiveDeviceId: 'breaker-1',
        type: 'BREAKER',
      },
    },
  ],
  ports: [
    { id: 'service-out', nodeId: 'service', role: 'POWER', direction: 'OUT' },
    { id: 'board-in', nodeId: 'board-node', role: 'POWER', direction: 'IN' },
    { id: 'board-out', nodeId: 'board-node', role: 'POWER', direction: 'OUT' },
    { id: 'load-in', nodeId: 'load-node', role: 'POWER', direction: 'IN' },
  ],
  edges: [
    {
      id: 'service-cable',
      kind: 'CABLE',
      fromPortId: 'service-out',
      toPortId: 'board-in',
      path: [
        { x: 0, y: 0, z: 0 },
        { x: 500, y: 0, z: 1_500 },
      ],
      properties: {
        circuitId: 'heating',
        conductorCount: 3,
        conductorMaterial: 'COPPER',
        conductorSectionMm2: 2.5,
      },
    },
    {
      id: 'load-cable',
      kind: 'CABLE',
      fromPortId: 'board-out',
      toPortId: 'load-in',
      path: [
        { x: 500, y: 0, z: 1_500 },
        { x: 5_000, y: 0, z: 500 },
      ],
      properties: {
        circuitId: 'heating',
        conductorCount: 3,
        conductorMaterial: 'COPPER',
        conductorSectionMm2: 2.5,
      },
    },
  ],
  circuits: [
    {
      id: 'heating',
      purpose: 'POWER',
      boardId: 'main-board',
      voltageV: 230,
      voltageReference: 'PHASE_NEUTRAL',
      phases: 1,
      conductorSectionMm2: 2.5,
      loadIds: ['heater'],
      protectiveDeviceId: 'breaker-1',
    },
  ],
};

describe('electrical network domain', () => {
  it('creates boards, circuits, loads, protections, and graph cables', () => {
    expect(validateElectricalNetwork(network)).toEqual([]);
    expect(createElectricalNetwork(network)).toEqual(network);
  });

  it('implements ELEC-004 with an explicit missing-board error', () => {
    const disconnected: ElectricalNetwork = {
      ...network,
      circuits: [{ ...network.circuits[0]!, boardId: 'missing-board' }],
    };
    expect(validateElectricalNetwork(disconnected)).toContainEqual(
      expect.objectContaining({
        code: 'ELEC_MISSING_REFERENCE',
        path: 'circuits[0].boardId',
      }),
    );
    expect(() => createElectricalNetwork(disconnected)).toThrow(
      /does not exist/,
    );
  });

  it('preserves unknown load power and conductor sections', () => {
    const unknown: ElectricalNetwork = {
      ...network,
      nodes: network.nodes.map((node) =>
        node.id === 'load-node'
          ? { ...node, load: { loadId: 'heater', name: 'Heater' } }
          : node,
      ),
      edges: network.edges.map(({ properties, ...cable }) => ({
        ...cable,
        properties: {
          circuitId: properties.circuitId,
          conductorCount: properties.conductorCount,
        },
      })),
      circuits: network.circuits.map(
        ({ conductorSectionMm2: _, ...circuit }) => circuit,
      ),
    };
    expect(validateElectricalNetwork(unknown)).toEqual([]);
    expect(createElectricalNetwork(unknown)).toEqual(unknown);
  });

  it('rejects duplicate references, invalid factors, and invalid cables', () => {
    const invalid: ElectricalNetwork = {
      ...network,
      nodes: network.nodes.map((node) =>
        node.id === 'load-node'
          ? { ...node, load: { ...node.load!, demandFactor: 1.1 } }
          : node,
      ),
      edges: network.edges.map((cable) => ({
        ...cable,
        properties: { ...cable.properties, conductorCount: 0 },
      })),
      circuits: [
        network.circuits[0]!,
        { ...network.circuits[0]!, loadIds: ['missing-load'] },
      ],
    };
    expect(validateElectricalNetwork(invalid).map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'ELEC_INVALID_LOAD',
        'ELEC_DUPLICATE_BUSINESS_ID',
        'ELEC_MISSING_REFERENCE',
        'ELEC_INVALID_CABLE',
      ]),
    );
  });
});
