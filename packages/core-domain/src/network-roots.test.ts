import { describe, expect, it } from 'vitest';
import {
  NETWORK_ROOT_KINDS,
  validateTechnicalNetwork,
  type NetworkDiscipline,
  type TechnicalNetwork,
} from './network.js';

function network(
  discipline: NetworkDiscipline,
  kinds: readonly string[],
): TechnicalNetwork {
  return {
    id: 'network',
    discipline,
    systemType: 'SYSTEM',
    nodes: kinds.map((kind, index) => ({
      id: `node-${index}`,
      kind,
      position: { x: index * 1000, y: 0, z: 0 },
    })),
    ports: [],
    edges: [],
  };
}

const codes = (entry: TechnicalNetwork): readonly string[] =>
  validateTechnicalNetwork(entry).map(({ code }) => code);

describe('what anchors a network', () => {
  it('accepts the node each discipline actually starts from', () => {
    // These are the kinds the editor's own templates create.
    expect(codes(network('WATER', ['SOURCE', 'FIXTURE']))).not.toContain(
      'NETWORK_MISSING_SOURCE',
    );
    expect(codes(network('WASTEWATER', ['FIXTURE', 'OUTLET']))).not.toContain(
      'NETWORK_MISSING_SOURCE',
    );
    expect(codes(network('VENTILATION', ['FAN', 'TERMINAL']))).not.toContain(
      'NETWORK_MISSING_SOURCE',
    );
    expect(
      codes(network('ELECTRICAL', ['DISTRIBUTION_BOARD', 'LUMINAIRE'])),
    ).not.toContain('NETWORK_MISSING_SOURCE');
  });

  it('still reports a network anchored by nothing', () => {
    expect(codes(network('WASTEWATER', ['FIXTURE']))).toContain(
      'NETWORK_MISSING_SOURCE',
    );
    expect(codes(network('ELECTRICAL', ['LUMINAIRE']))).toContain(
      'NETWORK_MISSING_SOURCE',
    );
  });

  it('names the anchors it was looking for', () => {
    const issue = validateTechnicalNetwork(
      network('ELECTRICAL', ['LUMINAIRE']),
    ).find(({ code }) => code === 'NETWORK_MISSING_SOURCE');
    expect(issue?.message).toContain('DISTRIBUTION_BOARD');
  });

  it('declares an anchor for every discipline', () => {
    for (const kinds of Object.values(NETWORK_ROOT_KINDS))
      expect(kinds.length).toBeGreaterThan(0);
  });
});
