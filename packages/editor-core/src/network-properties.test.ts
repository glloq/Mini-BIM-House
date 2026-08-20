import { describe, expect, it } from 'vitest';
import type {
  NetworkEdge,
  Project,
  TechnicalNetwork,
} from '@house-technical-designer/core-domain';
import {
  ConnectNetworkPortsCommand,
  ProjectCommandDispatcher,
  UpdateNetworkEdgeCommand,
  UpdateNetworkNodeCommand,
  edgePropertySchema,
  incoherentNetworkProperties,
  invalidNetworkProperties,
  networkSystemTemplates,
  nodePropertySchema,
  withNetworkProperty,
  withoutIncompatibleProperties,
} from './index.js';

function network(): TechnicalNetwork {
  return {
    id: 'water',
    discipline: 'WATER',
    systemType: 'POTABLE_COLD',
    nodes: [
      { id: 'source', kind: 'SOURCE', position: { x: 0, y: 0, z: 0 } },
      { id: 'sink', kind: 'FIXTURE', position: { x: 3000, y: 0, z: 0 } },
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
    ],
  };
}

function project(): Project {
  return {
    metadata: {
      name: 'Réseaux',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    building: { levels: [] },
    systems: [network()],
  } as unknown as Project;
}

function connected(): ProjectCommandDispatcher {
  const commands = new ProjectCommandDispatcher(project());
  commands.dispatch(new ConnectNetworkPortsCommand('water', pipe()));
  return commands;
}

const edgeOf = (commands: ProjectCommandDispatcher) =>
  commands.project.systems?.[0]?.edges[0];
const nodeOf = (commands: ProjectCommandDispatcher, id: string) =>
  commands.project.systems?.[0]?.nodes.find((node) => node.id === id);

describe('what a network object may be given', () => {
  it('describes the terminals and the segments of each discipline', () => {
    expect(
      nodePropertySchema('WATER', 'FIXTURE').map(({ key }) => key),
    ).toEqual(['designFlowLps', 'minimumPressurePa']);
    // A fixed appliance is a load like any other, and can be placed as one.
    expect(nodePropertySchema('ELECTRICAL', 'FIXED_LOAD')[0]?.key).toBe(
      'activePowerW',
    );
    expect(nodePropertySchema('VENTILATION', 'TERMINAL')[0]?.key).toBe(
      'targetFlowM3h',
    );
    expect(edgePropertySchema('WATER').map(({ key }) => key)).toContain(
      'internalDiameterM',
    );
    expect(edgePropertySchema('ELECTRICAL').map(({ key }) => key)).toContain(
      'conductorSectionMm2',
    );
    // A node kind nobody described is not an error; it simply carries nothing.
    expect(nodePropertySchema('WATER', 'JUNCTION')).toEqual([]);
  });

  it('names the systems a discipline offers instead of asking for a word', () => {
    expect(
      networkSystemTemplates('VENTILATION').map(({ systemType }) => systemType),
    ).toContain('BALANCED_HEAT_RECOVERY');
    expect(networkSystemTemplates('WATER')[0]?.label).toBe(
      'Eau froide sanitaire',
    );
  });
});

describe('editing a physical property', () => {
  const diameter = edgePropertySchema('WATER')[0]!;

  it('reads a number the way the field was typed', () => {
    expect(withNetworkProperty({}, diameter, '0,016')).toEqual({
      internalDiameterM: 0.016,
    });
    expect(withNetworkProperty({}, diameter, 'gros')).toBeUndefined();
  });

  it('removes the property when the field is emptied', () => {
    // Not zero, and not NaN: a pipe nobody has sized is a pipe with no stated
    // bore, and the module must say so.
    expect(
      withNetworkProperty({ internalDiameterM: 0.016 }, diameter, ''),
    ).toEqual({});
  });

  it('refuses a choice that is not offered', () => {
    const material = edgePropertySchema('WATER').find(
      ({ key }) => key === 'materialId',
    )!;
    expect(withNetworkProperty({}, material, 'copper')).toEqual({
      materialId: 'copper',
    });
    expect(withNetworkProperty({}, material, 'adamantium')).toBeUndefined();
  });

  it('states the bounds a value has to respect', () => {
    const powerFactor = nodePropertySchema('ELECTRICAL', 'OUTLET').find(
      ({ key }) => key === 'powerFactor',
    )!;
    expect(
      invalidNetworkProperties([powerFactor], { powerFactor: 0.9 }),
    ).toEqual([]);
    expect(
      invalidNetworkProperties([powerFactor], { powerFactor: 1.4 })[0],
    ).toContain('Facteur de puissance');
    expect(
      invalidNetworkProperties([powerFactor], { powerFactor: -1 })[0],
    ).toContain('Facteur de puissance');
  });
});

describe('writing properties onto a network', () => {
  it('stores what a terminal states about itself', () => {
    const commands = connected();
    expect(
      commands.dispatch(
        new UpdateNetworkNodeCommand('water', 'sink', {
          properties: { designFlowLps: 0.2 },
        }),
      ).status,
    ).toBe('APPLIED');
    expect(nodeOf(commands, 'sink')?.properties).toEqual({
      designFlowLps: 0.2,
    });
  });

  it('refuses a flow below zero', () => {
    const commands = connected();
    const rejected = commands.dispatch(
      new UpdateNetworkNodeCommand('water', 'sink', {
        properties: { designFlowLps: -3 },
      }),
    );
    expect(rejected.status).toBe('REJECTED');
    expect(nodeOf(commands, 'sink')?.properties).toBeUndefined();
  });

  it('sizes a segment and lets the size be taken back', () => {
    const commands = connected();
    commands.dispatch(
      new UpdateNetworkEdgeCommand('water', 'trunk', {
        internalDiameterM: 0.016,
        materialId: 'copper',
      }),
    );
    expect(edgeOf(commands)?.properties).toEqual({
      internalDiameterM: 0.016,
      materialId: 'copper',
    });
    commands.dispatch(new UpdateNetworkEdgeCommand('water', 'trunk', {}));
    expect(edgeOf(commands)?.properties).toBeUndefined();
  });

  it('refuses a value no project file could hold', () => {
    const commands = connected();
    const rejected = commands.dispatch(
      new UpdateNetworkEdgeCommand('water', 'trunk', {
        internalDiameterM: Number.NaN,
      }),
    );
    expect(rejected.status).toBe('REJECTED');
    if (rejected.status !== 'REJECTED') return;
    expect(rejected.errors[0]).toContain('internalDiameterM');
  });

  it('refuses to bind a node to equipment the project does not hold', () => {
    const commands = connected();
    const rejected = commands.dispatch(
      new UpdateNetworkNodeCommand('water', 'sink', {
        equipmentId: 'boiler-that-does-not-exist',
      }),
    );
    expect(rejected.status).toBe('REJECTED');
  });
});

describe('a duct and the section it declares', () => {
  const shapeOf = (value: string) => ({ shape: value });

  it('asks a round duct for a diameter and a rectangular one for two sides', () => {
    const keys = edgePropertySchema('VENTILATION').map(({ key }) => key);
    expect(keys).toContain('diameterM');
    expect(keys).toContain('widthM');
    expect(keys).toContain('heightM');
  });

  it('refuses a round duct given a width', () => {
    expect(
      incoherentNetworkProperties('VENTILATION', {
        ...shapeOf('ROUND'),
        widthM: 0.3,
      })[0],
    ).toContain('diamètre');
  });

  it('refuses a rectangular duct given a diameter', () => {
    expect(
      incoherentNetworkProperties('VENTILATION', {
        ...shapeOf('RECTANGULAR'),
        diameterM: 0.16,
      })[0],
    ).toContain('largeur');
  });

  it('refuses a rectangular duct given one side only', () => {
    expect(
      incoherentNetworkProperties('VENTILATION', {
        ...shapeOf('RECTANGULAR'),
        widthM: 0.4,
      }),
    ).toHaveLength(1);
    expect(
      incoherentNetworkProperties('VENTILATION', {
        ...shapeOf('RECTANGULAR'),
        widthM: 0.4,
        heightM: 0.2,
      }),
    ).toEqual([]);
  });

  it('leaves the other disciplines alone', () => {
    expect(
      incoherentNetworkProperties('WATER', { internalDiameterM: 0.016 }),
    ).toEqual([]);
  });
});

describe('changing the section of a duct', () => {
  it('drops the dimensions the new shape cannot carry', () => {
    expect(
      withoutIncompatibleProperties('VENTILATION', {
        shape: 'RECTANGULAR',
        diameterM: 0.16,
        widthM: 0.2,
        heightM: 0.1,
      }),
    ).toEqual({ shape: 'RECTANGULAR', widthM: 0.2, heightM: 0.1 });
    expect(
      withoutIncompatibleProperties('VENTILATION', {
        shape: 'ROUND',
        diameterM: 0.16,
        widthM: 0.2,
      }),
    ).toEqual({ shape: 'ROUND', diameterM: 0.16 });
  });

  it('keeps everything the shape still uses', () => {
    const kept = withoutIncompatibleProperties('VENTILATION', {
      shape: 'ROUND',
      diameterM: 0.16,
      roughnessM: 0.00009,
      airRole: 'EXTRACT',
    });
    expect(kept).toMatchObject({ roughnessM: 0.00009, airRole: 'EXTRACT' });
  });
});
