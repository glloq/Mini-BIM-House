import { describe, expect, it } from 'vitest';
import type { Point3D } from '@house-technical-designer/geometry';
import {
  analyzeWastewaterNetwork,
  type WastewaterFlowMethod,
  type WastewaterNetwork,
} from './wastewater.js';

const point = (x: number, z: number): Point3D => ({ x, y: 0, z });
const method: WastewaterFlowMethod = {
  id: 'test-flow',
  version: '1',
  designFlowM3s: (units) => units * 0.001,
};

function network(endZ = 0): WastewaterNetwork {
  return {
    id: 'ww',
    discipline: 'WASTEWATER',
    systemType: 'GREYWATER',
    metadata: {},
    nodes: [
      {
        id: 'fixture-a',
        kind: 'FIXTURE',
        position: point(0, 100),
        dischargeUnits: 1,
      },
      {
        id: 'fixture-b',
        kind: 'FIXTURE',
        position: point(0, 100),
        dischargeUnits: 2,
      },
      { id: 'junction', kind: 'JUNCTION', position: point(1_000, 50) },
      { id: 'outlet', kind: 'OUTLET', position: point(2_000, endZ) },
    ],
    ports: [
      { id: 'a-out', nodeId: 'fixture-a', role: 'FLOW', direction: 'OUT' },
      { id: 'b-out', nodeId: 'fixture-b', role: 'FLOW', direction: 'OUT' },
      { id: 'j-in-a', nodeId: 'junction', role: 'FLOW', direction: 'IN' },
      { id: 'j-in-b', nodeId: 'junction', role: 'FLOW', direction: 'IN' },
      { id: 'j-out', nodeId: 'junction', role: 'FLOW', direction: 'OUT' },
      { id: 'out-in', nodeId: 'outlet', role: 'FLOW', direction: 'IN' },
    ],
    edges: [
      {
        id: 'a',
        kind: 'GRAVITY_PIPE',
        fromPortId: 'a-out',
        toPortId: 'j-in-a',
        path: [point(0, 100), point(1_000, 50)],
        properties: { internalDiameterM: 0.05 },
      },
      {
        id: 'b',
        kind: 'GRAVITY_PIPE',
        fromPortId: 'b-out',
        toPortId: 'j-in-b',
        path: [point(0, 100), point(1_000, 50)],
        properties: { internalDiameterM: 0.05 },
      },
      {
        id: 'collector',
        kind: 'GRAVITY_PIPE',
        fromPortId: 'j-out',
        toPortId: 'out-in',
        path: [point(1_000, 50), point(2_000, endZ)],
        properties: { internalDiameterM: 0.1 },
      },
    ],
  };
}

describe('wastewater analysis', () => {
  it('WW-001 derives slope from path elevation drop and horizontal length', () => {
    const segment = analyzeWastewaterNetwork(network(), method).segments.find(
      ({ segmentId }) => segmentId === 'collector',
    );
    expect(segment).toMatchObject({
      lengthM: 1,
      elevationDropM: 0.05,
      slope: 0.05,
    });
  });
  it('WW-002 detects a reverse slope', () => {
    const result = analyzeWastewaterNetwork(network(100), method);
    expect(
      result.diagnostics.some(
        ({ code, entityId }) =>
          code === 'WASTEWATER_REVERSE_SLOPE' && entityId === 'collector',
      ),
    ).toBe(true);
  });
  it('WW-003 reports nodes disconnected from the outlet', () => {
    const input = network();
    const result = analyzeWastewaterNetwork(
      { ...input, edges: input.edges.filter(({ id }) => id !== 'collector') },
      method,
    );
    expect(
      result.diagnostics.some(({ code }) => code === 'WASTEWATER_DISCONNECTED'),
    ).toBe(true);
  });
  it('WW-004 recalculates elevations from moved path geometry', () => {
    const before = analyzeWastewaterNetwork(network(0), method).segments.find(
      ({ segmentId }) => segmentId === 'collector',
    );
    const after = analyzeWastewaterNetwork(network(25), method).segments.find(
      ({ segmentId }) => segmentId === 'collector',
    );
    expect(before?.elevationDropM).toBe(0.05);
    expect(after?.elevationDropM).toBe(0.025);
  });
  it('WW-004 reports a level conflict when a node moves without its path', () => {
    const input = network();
    const moved = {
      ...input,
      nodes: input.nodes.map((node) =>
        node.id === 'outlet' ? { ...node, position: point(2_000, 25) } : node,
      ),
    };
    const result = analyzeWastewaterNetwork(moved, method);
    expect(
      result.diagnostics.some(
        ({ code, entityId }) =>
          code === 'WASTEWATER_LEVEL_CONFLICT' && entityId === 'collector',
      ),
    ).toBe(true);
  });
  it('WW-005 aggregates upstream fixture units through the active method', () => {
    const result = analyzeWastewaterNetwork(network(), method);
    expect(
      result.segments.find(({ segmentId }) => segmentId === 'collector'),
    ).toMatchObject({ totalDischargeUnits: 3, designFlowM3s: 0.003 });
  });
  it('keeps design flow unknown when no external method is active', () => {
    const result = analyzeWastewaterNetwork(network());
    expect(result.status).toBe('PARTIAL');
    expect(result.segments[0]?.designFlowM3s).toBeUndefined();
    expect(
      result.diagnostics.some(
        ({ code }) => code === 'WASTEWATER_METHOD_MISSING',
      ),
    ).toBe(true);
  });
});
