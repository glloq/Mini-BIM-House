import { describe, expect, it } from 'vitest';
import {
  connectedComponents,
  findNodePath,
  hasNetworkCycle,
  validateTechnicalNetwork,
  type TechnicalNetwork,
} from './network.js';

const point = (x: number) => ({ x, y: 0, z: 300 });

function lineNetwork(): TechnicalNetwork {
  return {
    id: 'network',
    discipline: 'WATER',
    systemType: 'POTABLE_COLD',
    nodes: [
      { id: 'source', kind: 'SOURCE', position: point(0) },
      { id: 'branch', kind: 'JUNCTION', position: point(1000) },
      { id: 'terminal', kind: 'TERMINAL', position: point(2000) },
    ],
    ports: [
      {
        id: 'source-out',
        nodeId: 'source',
        role: 'SUPPLY',
        direction: 'OUT',
        connectionType: 'PIPE',
        nominalSize: 12,
      },
      {
        id: 'branch-in',
        nodeId: 'branch',
        role: 'IN',
        direction: 'IN',
        connectionType: 'PIPE',
        nominalSize: 12,
      },
      {
        id: 'branch-out',
        nodeId: 'branch',
        role: 'OUT',
        direction: 'OUT',
        connectionType: 'PIPE',
        nominalSize: 12,
      },
      {
        id: 'terminal-in',
        nodeId: 'terminal',
        role: 'IN',
        direction: 'IN',
        connectionType: 'PIPE',
        nominalSize: 12,
      },
    ],
    edges: [
      {
        id: 'first',
        fromPortId: 'source-out',
        toPortId: 'branch-in',
        kind: 'PIPE',
        path: [point(0), point(1000)],
      },
      {
        id: 'second',
        fromPortId: 'branch-out',
        toPortId: 'terminal-in',
        kind: 'PIPE',
        path: [point(1000), point(2000)],
      },
    ],
  };
}

describe('technical network graph', () => {
  it('connects ports and finds a deterministic source-to-terminal path', () => {
    const network = lineNetwork();
    expect(validateTechnicalNetwork(network)).toEqual([]);
    expect(findNodePath(network, 'source', 'terminal')).toEqual([
      'source',
      'branch',
      'terminal',
    ]);
    expect(connectedComponents(network)).toEqual([
      ['branch', 'source', 'terminal'],
    ]);
  });

  it('detects disconnected components', () => {
    const network = lineNetwork();
    const disconnected = { ...network, edges: network.edges.slice(0, 1) };
    expect(connectedComponents(disconnected)).toEqual([
      ['branch', 'source'],
      ['terminal'],
    ]);
    expect(findNodePath(disconnected, 'source', 'terminal')).toBeUndefined();
  });

  it('detects a cycle without assuming that networks are trees', () => {
    const network = lineNetwork();
    const cyclic: TechnicalNetwork = {
      ...network,
      ports: [
        ...network.ports,
        {
          id: 'terminal-out',
          nodeId: 'terminal',
          role: 'RETURN',
          direction: 'OUT',
        },
        { id: 'source-in', nodeId: 'source', role: 'RETURN', direction: 'IN' },
      ],
      edges: [
        ...network.edges,
        {
          id: 'return',
          fromPortId: 'terminal-out',
          toPortId: 'source-in',
          kind: 'PIPE',
          path: [point(2000), point(0)],
        },
      ],
    };
    expect(hasNetworkCycle(network)).toBe(false);
    expect(hasNetworkCycle(cyclic)).toBe(true);
  });

  it('reports an orphan port after its node is removed', () => {
    const network = lineNetwork();
    const withoutTerminal = {
      ...network,
      nodes: network.nodes.filter(({ id }) => id !== 'terminal'),
    };
    expect(
      validateTechnicalNetwork(withoutTerminal).map(({ code }) => code),
    ).toContain('NETWORK_ORPHAN_PORT');
  });

  it('reports incompatible ports, duplicate connections, and invalid paths', () => {
    const network = lineNetwork();
    const invalid: TechnicalNetwork = {
      ...network,
      ports: network.ports.map((port) =>
        port.id === 'branch-in' ? { ...port, connectionType: 'DUCT' } : port,
      ),
      edges: [
        network.edges[0]!,
        { ...network.edges[0]!, id: 'duplicate', path: [point(0), point(0)] },
      ],
    };
    const codes = validateTechnicalNetwork(invalid).map(({ code }) => code);
    expect(codes).toContain('NETWORK_INCOMPATIBLE_PORTS');
    expect(codes).toContain('NETWORK_DUPLICATE_CONNECTION');
    expect(codes).toContain('NETWORK_INVALID_PATH');
  });

  it('rejects duplicate IDs, reused ports, and non-finite node positions', () => {
    const network = lineNetwork();
    const invalid: TechnicalNetwork = {
      ...network,
      nodes: [
        ...network.nodes,
        { id: 'terminal', kind: 'DUPLICATE', position: { x: NaN, y: 0, z: 0 } },
      ],
      edges: [
        ...network.edges,
        {
          id: 'reuse',
          fromPortId: 'source-out',
          toPortId: 'terminal-in',
          kind: 'PIPE',
          path: [point(0), point(2000)],
        },
      ],
    };
    const codes = validateTechnicalNetwork(invalid).map(({ code }) => code);
    expect(codes).toContain('NETWORK_DUPLICATE_ID');
    expect(codes).toContain('NETWORK_INVALID_POSITION');
    expect(codes).toContain('NETWORK_DUPLICATE_CONNECTION');
  });
});
