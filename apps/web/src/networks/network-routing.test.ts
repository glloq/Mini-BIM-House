import { describe, expect, it } from 'vitest';
import {
  MoveNetworkEdgeVertexCommand,
  ProjectCommandDispatcher,
  routeFall,
  routeThrough,
  slopedRoute,
} from '@house-technical-designer/editor-core';
import { portAnchors } from '@house-technical-designer/core-domain';
import { loadDemoProject } from '../demo-project.js';
import { branchCommand, routeCommand } from './network-model.js';
import { routeGrips } from '../editor/grips.js';
import { boundsOf, relationshipsOf } from '../editor/object-editors.js';

function project() {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file.project;
}

function waterNetwork() {
  return (project().systems ?? []).find(({ id }) => id === 'water')!;
}

let counter = 0;
const newId = (prefix: string): string => `${prefix}-routed-${(counter += 1)}`;

describe('where the ports of a network fall on the plan', () => {
  it('places every port near the node it belongs to', () => {
    const network = waterNetwork();
    const anchors = portAnchors(network);
    expect(anchors.size).toBe(network.ports.length);
    for (const port of network.ports) {
      const node = network.nodes.find(({ id }) => id === port.nodeId)!;
      const at = anchors.get(port.id)!;
      // Near enough to read as belonging to the node, far enough to be
      // clicked on its own.
      expect(
        Math.hypot(at.x - node.position.x, at.y - node.position.y),
      ).toBeCloseTo(180, 6);
    }
  });

  it('places them the same way every time', () => {
    const first = portAnchors(waterNetwork());
    const second = portAnchors(waterNetwork());
    for (const [id, at] of first) expect(second.get(id)).toEqual(at);
  });
});

describe('a run drawn on the plan', () => {
  it('keeps every corner the user placed', () => {
    const route = routeThrough(
      { x: 0, y: 0, z: 500 },
      [
        { x: 1000, y: 0 },
        { x: 1000, y: 2000 },
      ],
      { x: 3000, y: 2000, z: 500 },
    );
    expect(route).toHaveLength(4);
    expect(route[1]).toEqual({ x: 1000, y: 0, z: 500 });
  });

  it('climbs at the last corner when the two ends differ in height', () => {
    // A riser one can see, rather than a slope hidden in a diagonal.
    const route = routeThrough({ x: 0, y: 0, z: 0 }, [{ x: 1000, y: 0 }], {
      x: 1000,
      y: 0,
      z: 2500,
    });
    expect(route.map(({ z }) => z)).toEqual([0, 0, 2500]);
  });

  it('falls at the slope that was asked for', () => {
    const route = slopedRoute(
      [
        { x: 0, y: 0, z: 1000 },
        { x: 2000, y: 0, z: 1000 },
        { x: 2000, y: 3000, z: 1000 },
      ],
      2,
    );
    // Two per cent of five metres walked is a hundred millimetres of fall.
    expect(route[2]!.z).toBeCloseTo(1000 - 100, 6);
  });

  it('reports the fall a route actually has', () => {
    const measured = routeFall([
      { x: 0, y: 0, z: 1000 },
      { x: 5000, y: 0, z: 900 },
    ]);
    expect(measured.runMm).toBe(5000);
    expect(measured.fallMm).toBe(100);
    expect(measured.slopePercent).toBeCloseTo(2, 6);
  });

  it('says nothing about the slope of a run of no length', () => {
    expect(
      routeFall([
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      ]).slopePercent,
    ).toBeUndefined();
  });
});

describe('routing between two ports from the plan', () => {
  it('asks for two ports rather than routing from nowhere', () => {
    expect(
      routeCommand(
        project(),
        'water',
        [undefined, undefined],
        [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
        ],
        { slopePercent: 0, riseMm: 0 },
        newId('edge'),
      ).status,
    ).toBe('ERROR');
  });

  it('refuses a run that starts and ends on the same port', () => {
    const port = waterNetwork().ports[0]!;
    expect(
      routeCommand(
        project(),
        'water',
        [port.id, port.id],
        [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
        ],
        { slopePercent: 0, riseMm: 0 },
        newId('edge'),
      ).status,
    ).toBe('ERROR');
  });

  it('says the network is unknown rather than throwing', () => {
    expect(
      routeCommand(
        project(),
        'nowhere',
        [],
        [],
        { slopePercent: 0, riseMm: 0 },
        newId('edge'),
      ).status,
    ).toBe('ERROR');
  });
});

describe('branching off a run that already exists', () => {
  it('cuts the run in two and leaves a spare outlet', () => {
    const source = project();
    const before = (source.systems ?? []).find(({ id }) => id === 'water')!;
    const result = branchCommand(
      source,
      'water:trunk',
      { x: 1000, y: 1000 },
      { nodeId: 'node-tee', newId },
    );
    if (result.status !== 'OK') throw new Error(result.message);
    const dispatcher = new ProjectCommandDispatcher(source);
    const applied = dispatcher.dispatch(result.command);
    expect(applied.status).toBe('APPLIED');
    const after = (dispatcher.project.systems ?? []).find(
      ({ id }) => id === 'water',
    )!;
    // One segment removed, two added; one node and its fitting's ports added.
    expect(after.edges).toHaveLength(before.edges.length + 1);
    expect(after.nodes).toHaveLength(before.nodes.length + 1);
    const connected = new Set(
      after.edges.flatMap(({ fromPortId, toPortId }) => [fromPortId, toPortId]),
    );
    expect(
      after.ports.filter(
        ({ nodeId, id }) => nodeId === 'node-tee' && !connected.has(id),
      ),
    ).toHaveLength(1);
  });

  it('puts the fitting on the run, at the nearest point to the click', () => {
    const result = branchCommand(
      project(),
      'water:trunk',
      { x: 1000, y: 1000 },
      { nodeId: 'node-tee', newId },
    );
    if (result.status !== 'OK') throw new Error(result.message);
    const dispatcher = new ProjectCommandDispatcher(project());
    dispatcher.dispatch(result.command);
    const node = (dispatcher.project.systems ?? [])
      .flatMap(({ nodes }) => nodes)
      .find(({ id }) => id === 'node-tee')!;
    const edge = (project().systems ?? [])
      .flatMap(({ edges }) => edges)
      .find(({ id }) => id === 'water:trunk')!;
    // On one of the run's own segments, never beside it.
    const onRun = edge.path.some(
      (point, index) =>
        index > 0 &&
        Math.abs(
          Math.hypot(
            node.position.x - edge.path[index - 1]!.x,
            node.position.y - edge.path[index - 1]!.y,
          ) +
            Math.hypot(point.x - node.position.x, point.y - node.position.y) -
            Math.hypot(
              point.x - edge.path[index - 1]!.x,
              point.y - edge.path[index - 1]!.y,
            ),
        ) < 0.001,
    );
    expect(onRun).toBe(true);
  });

  it('says the segment is unknown rather than throwing', () => {
    expect(
      branchCommand(
        project(),
        'nowhere',
        { x: 0, y: 0 },
        { nodeId: 'node-tee', newId },
      ).status,
    ).toBe('ERROR');
  });
});

describe('a routed segment as an object of the plan', () => {
  it('offers a handle for each corner and none for its ends', () => {
    const source = project();
    // The trunk turns once, so it has one corner and two ends.
    const edge = (source.systems ?? [])
      .flatMap(({ edges }) => edges)
      .find(({ id }) => id === 'water:trunk')!;
    expect(edge.path.length).toBeGreaterThan(2);
    expect(routeGrips(source, 'ground', edge.id)).toHaveLength(
      edge.path.length - 2,
    );
  });

  it('refuses to move an end away from its port', () => {
    const source = project();
    const network = (source.systems ?? []).find(({ id }) => id === 'water')!;
    const edge = network.edges[0]!;
    const dispatcher = new ProjectCommandDispatcher(source);
    expect(
      dispatcher.dispatch(
        new MoveNetworkEdgeVertexCommand(network.id, edge.id, 0, {
          x: 0,
          y: 0,
        }),
      ).status,
    ).toBe('REJECTED');
  });

  it('is measured and tied to the nodes it joins', () => {
    const source = project();
    expect(boundsOf(source, 'ground', 'water:trunk')).toBeDefined();
    const ties = relationshipsOf(source, 'ground', 'water:trunk');
    expect(ties.map(({ role }) => role)).toContain('Nœuds reliés');
  });
});
