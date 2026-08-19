import { describe, expect, it } from 'vitest';
import {
  createWaterNetwork,
  detectWaterCrossConnectionRisks,
  validateWaterNetwork,
  waterQuality,
  type WaterNetwork,
} from './water-domain.js';

function network(
  id: string,
  systemType: WaterNetwork['systemType'] = 'POTABLE_COLD',
): WaterNetwork {
  return {
    id,
    discipline: systemType === 'RAINWATER' ? 'RAINWATER' : 'WATER',
    systemType,
    nodes: [
      { id: `${id}-source`, kind: 'SOURCE', position: { x: 0, y: 0, z: 0 } },
      {
        id: `${id}-fixture`,
        kind: 'FIXTURE',
        position: { x: 1000, y: 0, z: 500 },
        hostObjectId: 'sink',
        fixture: { fixtureType: 'SINK' },
      },
    ],
    ports: [
      {
        id: `${id}-out`,
        nodeId: `${id}-source`,
        role: 'OUT',
        direction: 'OUT',
      },
      { id: `${id}-in`, nodeId: `${id}-fixture`, role: 'IN', direction: 'IN' },
    ],
    edges: [
      {
        id: `${id}-pipe`,
        fromPortId: `${id}-out`,
        toPortId: `${id}-in`,
        kind: 'PIPE',
        path: [
          { x: 0, y: 0, z: 0 },
          { x: 1000, y: 0, z: 500 },
        ],
        properties: { internalDiameterM: 0.012, materialId: 'pex' },
      },
    ],
  };
}

describe('water supply domain', () => {
  it('keeps potable and non-potable system semantics explicit', () => {
    expect(waterQuality('POTABLE_COLD')).toBe('POTABLE');
    expect(waterQuality('DOMESTIC_HOT_WATER')).toBe('POTABLE');
    expect(waterQuality('NON_POTABLE')).toBe('NON_POTABLE');
    expect(waterQuality('RAINWATER')).toBe('NON_POTABLE');
    expect(waterQuality('OTHER')).toBe('UNSPECIFIED');
  });

  it('preserves unknown pipe properties as warnings', () => {
    const value = network('cold');
    const unknown: WaterNetwork = {
      ...value,
      edges: value.edges.map((edge) => ({ ...edge, properties: {} })),
    };
    const issues = validateWaterNetwork(unknown);
    expect(issues).toHaveLength(2);
    expect(
      issues.every(
        ({ code, severity }) =>
          code === 'WATER_UNKNOWN_PIPE_PROPERTIES' && severity === 'WARNING',
      ),
    ).toBe(true);
    expect(
      createWaterNetwork(unknown).edges[0]?.properties?.internalDiameterM,
    ).toBeUndefined();
  });

  it('rejects invalid diameters without inventing a replacement', () => {
    const value = network('cold');
    const invalid: WaterNetwork = {
      ...value,
      edges: value.edges.map((edge) => ({
        ...edge,
        properties: { ...edge.properties, internalDiameterM: 0 },
      })),
    };
    expect(validateWaterNetwork(invalid).map(({ code }) => code)).toContain(
      'WATER_INVALID_DIAMETER',
    );
    expect(() => createWaterNetwork(invalid)).toThrow(/diameter/);
  });

  it('reports a potable/non-potable shared-host risk deterministically', () => {
    const issues = detectWaterCrossConnectionRisks([
      network('rain', 'RAINWATER'),
      network('cold'),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: 'WATER_CROSS_CONNECTION_RISK',
      path: 'hostObjects/sink',
      severity: 'WARNING',
    });
  });

  it('validates fixture ranges and rainwater discipline', () => {
    const value = network('rain', 'RAINWATER');
    const invalid: WaterNetwork = {
      ...value,
      discipline: 'WATER',
      nodes: value.nodes.map((node) =>
        node.kind === 'FIXTURE'
          ? { ...node, fixture: { fixtureType: '', hotWaterFraction: 2 } }
          : node,
      ),
    };
    expect(validateWaterNetwork(invalid).map(({ code }) => code)).toEqual([
      'WATER_INVALID_NETWORK_TYPE',
      'WATER_INVALID_FIXTURE',
    ]);
  });
});
