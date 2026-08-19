import { describe, expect, it } from 'vitest';
import {
  createVentilationNetwork,
  validateVentilationNetwork,
  type VentilationNetwork,
} from './ventilation-domain.js';

const network: VentilationNetwork = {
  id: 'ventilation-1',
  discipline: 'VENTILATION',
  systemType: 'SUPPLY',
  nodes: [
    { id: 'source', kind: 'SOURCE', position: { x: 0, y: 0, z: 0 } },
    {
      id: 'terminal',
      kind: 'TERMINAL',
      position: { x: 3_000, y: 0, z: 2_400 },
      terminal: { roomId: 'living-room', role: 'SUPPLY', targetFlowM3h: 30 },
    },
  ],
  ports: [
    {
      id: 'source-out',
      nodeId: 'source',
      role: 'AIR',
      direction: 'OUT',
      connectionType: 'DUCT',
    },
    {
      id: 'terminal-in',
      nodeId: 'terminal',
      role: 'AIR',
      direction: 'IN',
      connectionType: 'DUCT',
    },
  ],
  edges: [
    {
      id: 'duct-1',
      kind: 'DUCT',
      fromPortId: 'source-out',
      toPortId: 'terminal-in',
      path: [
        { x: 0, y: 0, z: 0 },
        { x: 3_000, y: 0, z: 2_400 },
      ],
      properties: { airRole: 'SUPPLY', shape: 'ROUND', diameterM: 0.125 },
    },
  ],
};

describe('ventilation network domain', () => {
  it('creates a typed network with terminals and round ducts', () => {
    expect(validateVentilationNetwork(network)).toEqual([]);
    expect(createVentilationNetwork(network)).toEqual(network);
  });

  it('keeps an unknown duct section explicit', () => {
    const unknown: VentilationNetwork = {
      ...network,
      edges: [
        {
          ...network.edges[0]!,
          properties: { airRole: 'SUPPLY', shape: 'ROUND' },
        },
      ],
    };
    expect(validateVentilationNetwork(unknown)).toEqual([
      expect.objectContaining({
        code: 'VENT_UNKNOWN_DUCT_SECTION',
        severity: 'WARNING',
      }),
    ]);
    expect(createVentilationNetwork(unknown)).toEqual(unknown);
  });

  it('rejects shape/dimension mismatches and invalid terminal targets', () => {
    const invalid: VentilationNetwork = {
      ...network,
      nodes: [
        network.nodes[0]!,
        {
          ...network.nodes[1]!,
          terminal: {
            roomId: 'living-room',
            role: 'SUPPLY',
            targetFlowM3h: 0,
          },
        },
      ],
      edges: [
        {
          ...network.edges[0]!,
          properties: {
            airRole: 'SUPPLY',
            shape: 'RECTANGULAR',
            diameterM: 0.125,
          },
        },
      ],
    };
    expect(validateVentilationNetwork(invalid).map(({ code }) => code)).toEqual(
      [
        'VENT_INVALID_TERMINAL',
        'VENT_UNKNOWN_DUCT_SECTION',
        'VENT_INVALID_DUCT',
      ],
    );
    expect(() => createVentilationNetwork(invalid)).toThrow(
      /target|missing or invalid/i,
    );
  });

  it('validates fans, filters, dampers, and heat-recovery equipment', () => {
    const fanNetwork: VentilationNetwork = {
      ...network,
      nodes: [
        network.nodes[0]!,
        {
          id: 'fan',
          kind: 'FAN',
          position: { x: 1_000, y: 0, z: 0 },
          fan: {
            curve: [
              { flowM3h: 0, pressurePa: 100 },
              { flowM3h: 100, pressurePa: 40 },
            ],
            efficiency: 0.7,
          },
        },
        {
          id: 'filter',
          kind: 'FILTER',
          position: { x: 2_000, y: 0, z: 0 },
          equipment: { type: 'FILTER', pressureDropPa: 30 },
        },
      ],
    };
    expect(validateVentilationNetwork(fanNetwork)).toEqual([]);
  });
});
