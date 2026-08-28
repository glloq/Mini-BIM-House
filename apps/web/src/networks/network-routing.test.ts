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
import {
  boundsOf,
  editsFor,
  relationshipsOf,
  removalCommandFor,
} from '../editor/object-editors.js';

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

  it('donne à la pièce le genre de ce que le tronçon porte', () => {
    /*
     * Insérer une pièce dans un tuyau ne change pas ce qu'il transporte.
     *
     * Elle était fabriquée depuis le gabarit de la discipline, qui ne connaît
     * qu'un genre par métier. Dériver le collecteur **unitaire** de la maison
     * de référence — celui qui porte les eaux usées et les eaux-vannes
     * réunies — créait donc un regard à ports d'eaux usées au milieu, et la
     * liaison était refusée : « COMBINED_WASTEWATER et GREYWATER ne sont pas
     * le même service ».
     */
    const source = project();
    const drainage = (source.systems ?? []).find(
      ({ id }) => id === 'wastewater',
    )!;
    const run = drainage.edges.find(({ id }) => id === 'wastewater:outfall')!;
    const genreOf = (portId: string): string | undefined =>
      drainage.ports.find(({ id }) => id === portId)?.portTypeId;
    expect(genreOf(run.fromPortId)).toBe('WASTEWATER_COMBINED');

    const result = branchCommand(
      source,
      'wastewater:outfall',
      { x: 9700, y: 7900 },
      { nodeId: 'node-unitaire', newId },
    );
    if (result.status !== 'OK') throw new Error(result.message);
    const dispatcher = new ProjectCommandDispatcher(source);
    // Rien ne doit être refusé : les deux moitiés reproduisent la paire
    // d'origine, donc elles valent exactement ce qu'elle valait.
    expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');

    const after = (dispatcher.project.systems ?? []).find(
      ({ id }) => id === 'wastewater',
    )!;
    const fitting = after.ports.filter(
      ({ nodeId }) => nodeId === 'node-unitaire',
    );
    const onTheRun = fitting.filter(({ id }) => !id.endsWith('-out-branch'));
    for (const port of onTheRun)
      expect(port.portTypeId, port.id).toMatch(/^WASTEWATER_COMBINED/u);
    // Et le piquage neuf garde le genre du métier : ce qu'on y raccordera est
    // un appareil de plus, pas la suite du collecteur.
    const spur = fitting.find(({ id }) => id.endsWith('-out-branch'))!;
    expect(spur.portTypeId).not.toBe('WASTEWATER_COMBINED');
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

  it('is edited where it is drawn, with the fields of its discipline', () => {
    // What a pipe is made of used to be sayable only in the networks
    // workspace, so a segment on the plan could be selected and not changed.
    const edits = editsFor(project(), 'water:trunk');
    expect(edits.map(({ id }) => id)).toContain('internalDiameterM');
    expect(
      edits.every(({ semanticId }) => semanticId.startsWith('networkEdge.')),
    ).toBe(true);
  });

  it('writes what is typed into the segment itself', () => {
    const source = project();
    const edit = editsFor(source, 'water:trunk').find(
      ({ id }) => id === 'internalDiameterM',
    )!;
    const command = edit.apply('0.016');
    expect(command).toBeDefined();
    const dispatcher = new ProjectCommandDispatcher(source);
    expect(dispatcher.dispatch(command!).status).toBe('APPLIED');
    const edge = (dispatcher.project.systems ?? [])
      .flatMap(({ edges }) => edges)
      .find(({ id }) => id === 'water:trunk')!;
    expect(edge.properties?.internalDiameterM).toBe(0.016);
  });

  it('forgets a property that is emptied rather than calling it zero', () => {
    const source = project();
    const edit = editsFor(source, 'water:trunk').find(
      ({ id }) => id === 'internalDiameterM',
    )!;
    const dispatcher = new ProjectCommandDispatcher(source);
    dispatcher.dispatch(edit.apply('')!);
    const edge = (dispatcher.project.systems ?? [])
      .flatMap(({ edges }) => edges)
      .find(({ id }) => id === 'water:trunk')!;
    expect(edge.properties?.internalDiameterM).toBeUndefined();
  });

  it('can be taken back off the plan like anything else', () => {
    const source = project();
    const command = removalCommandFor(source, 'ground', 'water:trunk');
    expect(command).toBeDefined();
    const dispatcher = new ProjectCommandDispatcher(source);
    expect(dispatcher.dispatch(command!).status).toBe('APPLIED');
    expect(
      (dispatcher.project.systems ?? [])
        .flatMap(({ edges }) => edges)
        .some(({ id }) => id === 'water:trunk'),
    ).toBe(false);
    // Only the segment: the nodes it joined are still there to be re-routed.
    expect(
      (dispatcher.project.systems ?? []).flatMap(({ nodes }) => nodes).length,
    ).toBe((source.systems ?? []).flatMap(({ nodes }) => nodes).length);
  });
});
