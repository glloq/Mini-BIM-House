import { describe, expect, it } from 'vitest';
import type { TechnicalNetwork } from '@house-technical-designer/core-domain';
import {
  modifyNetworkEdgePath,
  NetworkDrawingTool,
  placeNetworkNode,
} from './network-tool.js';

const base: TechnicalNetwork = {
  id: 'water',
  discipline: 'WATER',
  systemType: 'POTABLE_COLD',
  nodes: [
    { id: 'source', kind: 'SOURCE', position: { x: 0, y: 0, z: 300 } },
    { id: 'sink', kind: 'TERMINAL', position: { x: 2000, y: 0, z: 600 } },
  ],
  ports: [
    {
      id: 'source-out',
      nodeId: 'source',
      role: 'OUT',
      direction: 'OUT',
      connectionType: 'PIPE',
      nominalSize: 12,
    },
    {
      id: 'sink-in',
      nodeId: 'sink',
      role: 'IN',
      direction: 'IN',
      connectionType: 'PIPE',
      nominalSize: 12,
    },
  ],
  edges: [],
};

describe('network drawing tool', () => {
  it('snaps compatible ports and commits a routed edge', () => {
    const tool = new NetworkDrawingTool({
      edgeId: () => 'edge',
      edgeKind: 'PIPE',
      maximumPortSnapDistanceMm: 150,
    });
    tool.start(base, 'source-out');
    tool.addWaypoint({ x: 1000, y: 250, z: 300 });
    const state = tool.updatePointer(base, { x: 1950, y: 20, z: 600 });
    expect(state).toMatchObject({
      status: 'ROUTING',
      snappedPortId: 'sink-in',
    });
    expect(base.edges).toEqual([]);
    const edit = tool.finish(base);
    expect(edit?.after.edges[0]).toMatchObject({
      id: 'edge',
      fromPortId: 'source-out',
      toPortId: 'sink-in',
    });
    expect(edit?.after.edges[0]?.path).toEqual([
      { x: 0, y: 0, z: 300 },
      { x: 1000, y: 250, z: 300 },
      { x: 2000, y: 0, z: 600 },
    ]);
  });

  it('does not snap incompatible ports', () => {
    const tool = new NetworkDrawingTool({
      edgeId: () => 'edge',
      edgeKind: 'PIPE',
      maximumPortSnapDistanceMm: 150,
    });
    const incompatible: TechnicalNetwork = {
      ...base,
      ports: base.ports.map((port) =>
        port.id === 'sink-in' ? { ...port, connectionType: 'DUCT' } : port,
      ),
    };
    tool.start(incompatible, 'source-out');
    const state = tool.updatePointer(incompatible, { x: 2000, y: 0, z: 600 });
    expect(state).toMatchObject({ status: 'ROUTING' });
    if (state.status !== 'ROUTING') throw new Error('Expected routing state');
    expect(state.snappedPortId).toBeUndefined();
    expect(tool.finish(incompatible)).toBeUndefined();
  });

  it('places a node with ports as one reversible edit snapshot', () => {
    const edit = placeNetworkNode(
      base,
      { id: 'junction', kind: 'JUNCTION', position: { x: 1000, y: 0, z: 300 } },
      [{ id: 'junction-in', nodeId: 'junction', role: 'IN', direction: 'IN' }],
    );
    expect(edit.before.nodes).toHaveLength(2);
    expect(edit.after.nodes).toHaveLength(3);
    expect(edit.changedObjectIds).toEqual(['junction', 'junction-in']);
  });

  it('modifies a route while retaining the previous snapshot', () => {
    const tool = new NetworkDrawingTool({
      edgeId: () => 'edge',
      edgeKind: 'PIPE',
      maximumPortSnapDistanceMm: 50,
    });
    tool.start(base, 'source-out');
    tool.updatePointer(base, { x: 2000, y: 0, z: 600 });
    const routed = tool.finish(base)!.after;
    const edit = modifyNetworkEdgePath(routed, 'edge', [
      { x: 0, y: 0, z: 300 },
      { x: 1000, y: 500, z: 300 },
      { x: 2000, y: 0, z: 600 },
    ]);
    expect(edit.before.edges[0]?.path).not.toEqual(edit.after.edges[0]?.path);
    expect(edit.after.edges[0]?.path).toHaveLength(3);
  });

  it('allows routing in a draft that already has an unrelated diagnostic', () => {
    const draft: TechnicalNetwork = {
      ...base,
      nodes: base.nodes.map((node) =>
        node.kind === 'SOURCE' ? { ...node, kind: 'EQUIPMENT' } : node,
      ),
    };
    const tool = new NetworkDrawingTool({
      edgeId: () => 'edge',
      edgeKind: 'PIPE',
      maximumPortSnapDistanceMm: 50,
    });
    tool.start(draft, 'source-out');
    tool.updatePointer(draft, { x: 2000, y: 0, z: 600 });
    expect(tool.finish(draft)?.after.edges).toHaveLength(1);
  });
});
