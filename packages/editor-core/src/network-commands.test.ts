import { describe, expect, it } from 'vitest';
import type {
  NetworkEdge,
  NetworkNode,
  Project,
  TechnicalNetwork,
} from '@house-technical-designer/core-domain';
import {
  AddNetworkCommand,
  AddNetworkNodeCommand,
  AddNetworkPortCommand,
  ConnectNetworkPortsCommand,
  ProjectCommandDispatcher,
  RemoveNetworkCommand,
  RemoveNetworkEdgeCommand,
  RemoveNetworkNodeCommand,
  RemoveNetworkPortCommand,
  UpdateNetworkNodeCommand,
  connectablePorts,
  draftNetwork,
  networkNodeTemplates,
  networkSummary,
  openPorts,
  orthogonalRoute,
  portsOfPlacedEquipment,
  templatePorts,
} from './index.js';

function baseProject(networks: readonly TechnicalNetwork[] = []): Project {
  return {
    metadata: {
      name: 'Réseaux',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    // A node may name the room it serves, so the project has to hold one: the
    // commands refuse a node placed in a room that does not exist.
    building: {
      levels: [
        {
          id: 'ground',
          name: 'Rez-de-chaussée',
          elevationMm: 0,
          defaultStoreyHeightMm: 2500,
          walls: [],
          slabs: [],
          roofs: [],
          openings: [],
          stairs: [],
          annotations: [],
          spaces: [{ id: 'space:bath', levelId: 'ground', name: 'Bain' }],
        },
      ],
      zones: [],
    },
    systems: networks,
  } as unknown as Project;
}

function waterNetwork(): TechnicalNetwork {
  return {
    id: 'water',
    discipline: 'WATER',
    systemType: 'POTABLE_COLD',
    nodes: [
      { id: 'source', kind: 'SOURCE', position: { x: 0, y: 0, z: 0 } },
      { id: 'sink', kind: 'FIXTURE', position: { x: 3000, y: 2000, z: 0 } },
    ],
    ports: [
      { id: 'source-out', nodeId: 'source', role: 'FLOW', direction: 'OUT' },
      { id: 'sink-in', nodeId: 'sink', role: 'FLOW', direction: 'IN' },
    ],
    edges: [],
  };
}

function pipe(): NetworkEdge {
  return {
    id: 'trunk',
    fromPortId: 'source-out',
    toPortId: 'sink-in',
    kind: 'PIPE',
    path: [
      { x: 0, y: 0, z: 0 },
      { x: 3000, y: 0, z: 0 },
      { x: 3000, y: 2000, z: 0 },
    ],
  };
}

describe('network authoring helpers', () => {
  it('turns a node template into ports named after the node', () => {
    const template = networkNodeTemplates('VENTILATION').find(
      ({ kind }) => kind === 'JUNCTION',
    )!;
    expect(templatePorts('vent:junction', template)).toEqual([
      {
        id: 'vent:junction-in',
        nodeId: 'vent:junction',
        role: 'AIR',
        direction: 'IN',
      },
      {
        id: 'vent:junction-out',
        nodeId: 'vent:junction',
        role: 'AIR',
        direction: 'OUT',
      },
    ]);
  });

  it('routes orthogonally and drops the corner when it adds nothing', () => {
    expect(
      orthogonalRoute({ x: 0, y: 0, z: 0 }, { x: 1000, y: 500, z: 0 }),
    ).toEqual([
      { x: 0, y: 0, z: 0 },
      { x: 1000, y: 0, z: 0 },
      { x: 1000, y: 500, z: 0 },
    ]);
    expect(
      orthogonalRoute({ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }),
    ).toEqual([
      { x: 0, y: 0, z: 0 },
      { x: 1000, y: 0, z: 0 },
    ]);
  });

  it('reports open ports and the developed length of the routes', () => {
    const summary = networkSummary({ ...waterNetwork(), edges: [pipe()] });
    expect(summary.nodeCount).toBe(2);
    expect(summary.edgeCount).toBe(1);
    expect(summary.openPortCount).toBe(0);
    expect(summary.routeLengthMm).toBe(5000);
  });

  it('offers only compatible, unconnected ports as a destination', () => {
    const network = waterNetwork();
    expect(connectablePorts(network, 'source-out').map(({ id }) => id)).toEqual(
      ['sink-in'],
    );
    const connected = { ...network, edges: [pipe()] };
    expect(connectablePorts(connected, 'source-out')).toEqual([]);
    expect(openPorts(connected)).toEqual([]);
  });

  it('drafts a network around the source node of its discipline', () => {
    const { network, source } = draftNetwork('vmc', 'VENTILATION', 'EXTRACT', {
      x: 100,
      y: 200,
      z: 2400,
    });
    expect(source.kind).toBe('FAN');
    expect(network.ports).toHaveLength(1);
    expect(network.edges).toEqual([]);
  });
});

describe('network commands', () => {
  it('adds and removes a network, and undoes both', () => {
    const dispatcher = new ProjectCommandDispatcher(baseProject());
    expect(
      dispatcher.dispatch(new AddNetworkCommand(waterNetwork())).status,
    ).toBe('APPLIED');
    expect(dispatcher.project.systems).toHaveLength(1);
    expect(dispatcher.dispatch(new RemoveNetworkCommand('water')).status).toBe(
      'APPLIED',
    );
    expect(dispatcher.project.systems).toHaveLength(0);
    expect(dispatcher.undo().status).toBe('APPLIED');
    expect(dispatcher.project.systems).toHaveLength(1);
    expect(dispatcher.undo().status).toBe('APPLIED');
    expect(dispatcher.project.systems).toHaveLength(0);
  });

  it('creates a drainage network even though it carries no source node', () => {
    const dispatcher = new ProjectCommandDispatcher(baseProject());
    const { network } = draftNetwork(
      'eu',
      'WASTEWATER',
      'COMBINED_WASTEWATER',
      { x: 0, y: 0, z: -200 },
    );
    expect(dispatcher.dispatch(new AddNetworkCommand(network)).status).toBe(
      'APPLIED',
    );
    // The missing source is not hidden: it stays reported as an open issue.
    expect(
      networkSummary(dispatcher.project.systems![0]!).issues.map(
        ({ code }) => code,
      ),
    ).toContain('NETWORK_MISSING_SOURCE');
  });

  it('refuses a duplicate network identifier', () => {
    const dispatcher = new ProjectCommandDispatcher(
      baseProject([waterNetwork()]),
    );
    const result = dispatcher.dispatch(new AddNetworkCommand(waterNetwork()));
    expect(result.status).toBe('REJECTED');
  });

  it('places a node with its ports and routes an edge to it', () => {
    const dispatcher = new ProjectCommandDispatcher(
      baseProject([waterNetwork()]),
    );
    const node: NetworkNode = {
      id: 'basin',
      kind: 'FIXTURE',
      position: { x: 5000, y: 1000, z: 0 },
    };
    expect(
      dispatcher.dispatch(
        new AddNetworkNodeCommand(
          'water',
          node,
          templatePorts('basin', networkNodeTemplates('WATER')[2]!),
        ),
      ).status,
    ).toBe('APPLIED');
    expect(dispatcher.project.systems![0]!.nodes).toHaveLength(3);
    expect(
      dispatcher.dispatch(new ConnectNetworkPortsCommand('water', pipe()))
        .status,
    ).toBe('APPLIED');
    expect(dispatcher.project.systems![0]!.edges).toHaveLength(1);
  });

  it('refuses a node whose ports belong to another node', () => {
    const dispatcher = new ProjectCommandDispatcher(
      baseProject([waterNetwork()]),
    );
    const result = dispatcher.dispatch(
      new AddNetworkNodeCommand(
        'water',
        { id: 'basin', kind: 'FIXTURE', position: { x: 0, y: 0, z: 0 } },
        [{ id: 'stray', nodeId: 'other', role: 'FLOW', direction: 'IN' }],
      ),
    );
    expect(result.status).toBe('REJECTED');
  });

  it('refuses to connect two ports that are already joined', () => {
    const dispatcher = new ProjectCommandDispatcher(
      baseProject([{ ...waterNetwork(), edges: [pipe()] }]),
    );
    const result = dispatcher.dispatch(
      new ConnectNetworkPortsCommand('water', { ...pipe(), id: 'again' }),
    );
    expect(result.status).toBe('REJECTED');
    if (result.status === 'REJECTED')
      expect(result.errors.join(' ')).toContain('already connected');
  });

  it('removes a node together with its ports and the edges reaching it', () => {
    const dispatcher = new ProjectCommandDispatcher(
      baseProject([{ ...waterNetwork(), edges: [pipe()] }]),
    );
    expect(
      dispatcher.dispatch(new RemoveNetworkNodeCommand('water', 'sink')).status,
    ).toBe('APPLIED');
    const network = dispatcher.project.systems![0]!;
    expect(network.nodes.map(({ id }) => id)).toEqual(['source']);
    expect(network.ports.map(({ id }) => id)).toEqual(['source-out']);
    expect(network.edges).toEqual([]);
    expect(dispatcher.undo().status).toBe('APPLIED');
    expect(dispatcher.project.systems![0]!.edges).toHaveLength(1);
  });

  it('keeps a port that still carries a segment', () => {
    const dispatcher = new ProjectCommandDispatcher(
      baseProject([{ ...waterNetwork(), edges: [pipe()] }]),
    );
    expect(
      dispatcher.dispatch(new RemoveNetworkPortCommand('water', 'sink-in'))
        .status,
    ).toBe('REJECTED');
    expect(
      dispatcher.dispatch(new RemoveNetworkEdgeCommand('water', 'trunk'))
        .status,
    ).toBe('APPLIED');
    expect(
      dispatcher.dispatch(new RemoveNetworkPortCommand('water', 'sink-in'))
        .status,
    ).toBe('APPLIED');
  });

  it('adds a second outgoing port so a junction can feed another branch', () => {
    const dispatcher = new ProjectCommandDispatcher(
      baseProject([waterNetwork()]),
    );
    expect(
      dispatcher.dispatch(
        new AddNetworkPortCommand('water', {
          id: 'source-out-2',
          nodeId: 'source',
          role: 'FLOW',
          direction: 'OUT',
        }),
      ).status,
    ).toBe('APPLIED');
    expect(dispatcher.project.systems![0]!.ports).toHaveLength(3);
  });

  it('refuses to put a node in a room the project does not hold', () => {
    const dispatcher = new ProjectCommandDispatcher(
      baseProject([waterNetwork()]),
    );
    const rejected = dispatcher.dispatch(
      new UpdateNetworkNodeCommand('water', 'sink', { spaceId: 'space:gone' }),
    );
    expect(rejected.status).toBe('REJECTED');
    if (rejected.status !== 'REJECTED') return;
    expect(rejected.errors.join(' ')).toContain('space:gone');
  });

  it('refuses a node whose level and whose room are not the same level', () => {
    // Each identifier exists; together they describe a place that does not, and
    // a project holding one is a project this application refuses to reopen.
    const project = baseProject([waterNetwork()]) as unknown as {
      building: { levels: Record<string, unknown>[] };
    };
    project.building.levels.push({
      id: 'first',
      name: 'Étage',
      elevationMm: 2500,
      defaultStoreyHeightMm: 2500,
      walls: [],
      slabs: [],
      roofs: [],
      openings: [],
      stairs: [],
      annotations: [],
      spaces: [{ id: 'space:bedroom', levelId: 'first', name: 'Chambre' }],
    });
    const dispatcher = new ProjectCommandDispatcher(
      project as unknown as Project,
    );
    const rejected = dispatcher.dispatch(
      new AddNetworkNodeCommand(
        'water',
        {
          id: 'upstairs',
          kind: 'FIXTURE',
          position: { x: 0, y: 0, z: 0 },
          levelId: 'ground',
          spaceId: 'space:bedroom',
        },
        [],
      ),
    );
    expect(rejected.status).toBe('REJECTED');
    if (rejected.status !== 'REJECTED') return;
    expect(rejected.errors.join(' ')).toContain('niveau first');

    // The same node on the level its room belongs to is accepted.
    expect(
      dispatcher.dispatch(
        new AddNetworkNodeCommand(
          'water',
          {
            id: 'upstairs',
            kind: 'FIXTURE',
            position: { x: 0, y: 0, z: 0 },
            levelId: 'first',
            spaceId: 'space:bedroom',
          },
          [],
        ),
      ).status,
    ).toBe('APPLIED');
  });

  it('drags the ends of the segments that reach a moved node', () => {
    const dispatcher = new ProjectCommandDispatcher(
      baseProject([{ ...waterNetwork(), edges: [pipe()] }]),
    );
    expect(
      dispatcher.dispatch(
        new UpdateNetworkNodeCommand('water', 'sink', {
          position: { x: 4000, y: 2500, z: 0 },
          spaceId: 'space:bath',
        }),
      ).status,
    ).toBe('APPLIED');
    const network = dispatcher.project.systems![0]!;
    expect(network.nodes[1]!.spaceId).toBe('space:bath');
    // Only the end that moved follows; the hand-drawn corner is preserved.
    expect(network.edges[0]!.path).toEqual([
      { x: 0, y: 0, z: 0 },
      { x: 3000, y: 0, z: 0 },
      { x: 4000, y: 2500, z: 0 },
    ]);
  });

  it('clears the space a node was assigned to', () => {
    const dispatcher = new ProjectCommandDispatcher(
      baseProject([
        {
          ...waterNetwork(),
          nodes: [
            { id: 'source', kind: 'SOURCE', position: { x: 0, y: 0, z: 0 } },
            {
              id: 'sink',
              kind: 'FIXTURE',
              position: { x: 3000, y: 2000, z: 0 },
              spaceId: 'space:kitchen',
            },
          ],
        },
      ]),
    );
    dispatcher.dispatch(
      new UpdateNetworkNodeCommand('water', 'sink', { spaceId: null }),
    );
    expect(dispatcher.project.systems![0]!.nodes[1]).not.toHaveProperty(
      'spaceId',
    );
  });

  it('refuses an edit that names an unknown network', () => {
    const dispatcher = new ProjectCommandDispatcher(baseProject());
    expect(
      dispatcher.dispatch(new RemoveNetworkEdgeCommand('ghost', 'trunk'))
        .status,
    ).toBe('REJECTED');
  });
});

/** A water network whose ports name their kinds, plus a drain that does not. */
function networkProject(): Project {
  return baseProject([
    {
      id: 'water',
      discipline: 'WATER',
      systemType: 'POTABLE_COLD',
      nodes: [
        { id: 'water:source', kind: 'SOURCE', position: { x: 0, y: 0, z: 0 } },
        {
          id: 'water:basin',
          kind: 'FIXTURE',
          position: { x: 1000, y: 0, z: 0 },
        },
        {
          id: 'water:drain',
          kind: 'OUTLET',
          position: { x: 2000, y: 0, z: 0 },
        },
      ],
      ports: [
        {
          id: 'water:source-out',
          nodeId: 'water:source',
          role: 'FLOW',
          direction: 'OUT',
          portTypeId: 'WATER_COLD',
        },
        {
          id: 'water:basin-in',
          nodeId: 'water:basin',
          role: 'FLOW',
          direction: 'IN',
          portTypeId: 'WATER_COLD',
        },
        {
          id: 'water:drain-in',
          nodeId: 'water:drain',
          role: 'FLOW',
          direction: 'IN',
          portTypeId: 'WASTEWATER_INLET',
        },
      ],
      edges: [],
    },
  ] as unknown as readonly TechnicalNetwork[]);
}

describe('what a network may be joined to', () => {
  it('names the kind of every port it creates from a system', () => {
    // A template said `FLOW` going `OUT`, which is true of an eau froide, an
    // eau usée and a circuit de chauffage alike — so nothing could tell
    // whether a run between two of them made sense.
    const [source] = templatePorts(
      'water:source',
      networkNodeTemplates('WATER')[0]!,
      'POTABLE_COLD',
    );
    expect(source?.portTypeId).toBe('WATER_COLD');
    const [extract] = templatePorts(
      'vent:fan',
      networkNodeTemplates('VENTILATION')[0]!,
      'EXTRACT',
    );
    expect(extract?.portTypeId).toBe('AIR_EXHAUST');
  });

  it('leaves a system it does not know unnamed rather than guessing', () => {
    const [port] = templatePorts(
      'other:source',
      networkNodeTemplates('OTHER')[0]!,
      'SOMETHING_ELSE',
    );
    expect(port?.portTypeId).toBeUndefined();
  });

  it('takes a heat pump’s ports from its own fiche, not from a template', () => {
    // Flow, return, power, control and a condensate drain are five different
    // things, and no pair of « system + IN/OUT » will ever produce them.
    const ports = portsOfPlacedEquipment('pump-node', {
      ports: [
        { id: 'flow', portTypeId: 'HEATING_FLOW' },
        { id: 'return', portTypeId: 'HEATING_RETURN' },
        { id: 'power', portTypeId: 'ELECTRICAL_AC' },
        { id: 'unnamed' },
      ],
    });
    expect(ports.map(({ id }) => id)).toEqual([
      'pump-node-flow',
      'pump-node-return',
      'pump-node-power',
    ]);
    expect(ports.map(({ portTypeId }) => portTypeId)).toEqual([
      'HEATING_FLOW',
      'HEATING_RETURN',
      'ELECTRICAL_AC',
    ]);
    expect(ports[0]?.direction).toBe('OUT');
  });

  it('never joins two ports that say nothing about themselves', () => {
    // An unknown fluid joined to an unknown fluid is a drawing nobody has
    // checked, and calling it valid is how it stays unchecked.
    const commands = new ProjectCommandDispatcher(
      baseProject([
        {
          id: 'other',
          discipline: 'OTHER',
          systemType: 'OTHER',
          nodes: [
            { id: 'a', kind: 'SOURCE', position: { x: 0, y: 0, z: 0 } },
            { id: 'b', kind: 'TERMINAL', position: { x: 1, y: 0, z: 0 } },
          ],
          ports: [
            { id: 'pa', nodeId: 'a', role: 'FLOW', direction: 'IN' },
            { id: 'pb', nodeId: 'b', role: 'FLOW', direction: 'IN' },
          ],
          edges: [],
        },
      ] as unknown as readonly TechnicalNetwork[]),
    );
    expect(
      commands.dispatch(
        new ConnectNetworkPortsCommand('other', {
          id: 'other:edge',
          fromPortId: 'pa',
          toPortId: 'pb',
          kind: 'SEGMENT',
          path: [
            { x: 0, y: 0, z: 0 },
            { x: 1000, y: 0, z: 0 },
          ],
        }),
      ).status,
    ).toBe('REJECTED');
  });

  it('refuses to draw a run that could not be built', () => {
    const commands = new ProjectCommandDispatcher(networkProject());
    const rejected = commands.dispatch(
      new ConnectNetworkPortsCommand('water', {
        id: 'water:bad',
        fromPortId: 'water:source-out',
        toPortId: 'water:drain-in',
        kind: 'PIPE',
        path: [
          { x: 0, y: 0, z: 0 },
          { x: 1000, y: 0, z: 0 },
        ],
      }),
    );
    expect(rejected.status).toBe('REJECTED');
  });

  it('draws the run that can', () => {
    const commands = new ProjectCommandDispatcher(networkProject());
    expect(
      commands.dispatch(
        new ConnectNetworkPortsCommand('water', {
          id: 'water:good',
          fromPortId: 'water:source-out',
          toPortId: 'water:basin-in',
          kind: 'PIPE',
          path: [
            { x: 0, y: 0, z: 0 },
            { x: 1000, y: 0, z: 0 },
          ],
        }),
      ).status,
    ).toBe('APPLIED');
  });
});
