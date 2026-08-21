import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import { networkProduct } from '@house-technical-designer/network-products';
import { ProjectCommandDispatcher } from './project-commands.js';
import { SetNetworkEdgeProductCommand } from './network-commands.js';
import {
  networkProductUpdates,
  withUpdatedNetworkProduct,
} from './product-updates.js';

function project(): Project {
  return {
    metadata: {
      name: 'Réseaux',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    building: { levels: [], zones: [] },
    systems: [
      {
        id: 'water',
        discipline: 'WATER',
        systemType: 'POTABLE_COLD',
        nodes: [
          { id: 'n1', kind: 'SOURCE', position: { x: 0, y: 0, z: 0 } },
          { id: 'n2', kind: 'FIXTURE', position: { x: 1, y: 0, z: 0 } },
        ],
        ports: [
          {
            id: 'p1',
            nodeId: 'n1',
            role: 'FLOW',
            direction: 'OUT',
            portTypeId: 'WATER_COLD',
          },
          {
            id: 'p2',
            nodeId: 'n2',
            role: 'FLOW',
            direction: 'IN',
            portTypeId: 'WATER_COLD',
          },
        ],
        edges: [
          {
            id: 'e1',
            fromPortId: 'p1',
            toPortId: 'p2',
            kind: 'PIPE',
            path: [
              { x: 0, y: 0, z: 0 },
              { x: 1000, y: 0, z: 0 },
            ],
          },
        ],
      },
    ],
  } as unknown as Project;
}

describe('what a project’s runs are made of', () => {
  it('copies the product into the project the first time a run names it', () => {
    // Reading the installed catalogue instead would resize every network
    // already drawn, the day somebody corrects a tube.
    const commands = new ProjectCommandDispatcher(project());
    expect(
      commands.dispatch(
        new SetNetworkEdgeProductCommand('water', 'e1', 'pipe-pex-16x1.5'),
      ).status,
    ).toBe('APPLIED');
    const held = commands.project.networkProducts ?? [];
    expect(held.map(({ id }) => id)).toEqual(['pipe-pex-16x1.5']);
    expect(held[0]?.properties.innerDiameterMm).toBe(
      networkProduct('pipe-pex-16x1.5')?.properties.innerDiameterMm,
    );
    expect(held[0]?.version).toBe('1.0.0');
  });

  it('copies it once, however many runs are made of it', () => {
    const commands = new ProjectCommandDispatcher(project());
    commands.dispatch(
      new SetNetworkEdgeProductCommand('water', 'e1', 'pipe-pex-16x1.5'),
    );
    commands.dispatch(
      new SetNetworkEdgeProductCommand('water', 'e1', 'pipe-pex-16x1.5'),
    );
    expect(commands.project.networkProducts).toHaveLength(1);
  });

  it('says nothing while the project and the catalogue agree', () => {
    const commands = new ProjectCommandDispatcher(project());
    commands.dispatch(
      new SetNetworkEdgeProductCommand('water', 'e1', 'pipe-pex-16x1.5'),
    );
    expect(networkProductUpdates(commands.project)).toEqual([]);
  });

  it('offers a correction instead of applying it', () => {
    // The price of a file that opens the same way in two years is that a
    // correction has to be accepted rather than arrive.
    const commands = new ProjectCommandDispatcher(project());
    commands.dispatch(
      new SetNetworkEdgeProductCommand('water', 'e1', 'pipe-pex-16x1.5'),
    );
    const stale: Project = {
      ...commands.project,
      networkProducts: (commands.project.networkProducts ?? []).map((held) => ({
        ...held,
        version: '0.9.0',
        properties: { ...held.properties, innerDiameterMm: 99 },
      })),
    };
    const [offer] = networkProductUpdates(stale);
    expect(offer?.productId).toBe('pipe-pex-16x1.5');
    expect(offer?.heldVersion).toBe('0.9.0');
    expect(offer?.catalogVersion).toBe('1.0.0');
    expect(offer?.changed).toContain('innerDiameterMm');
    // Until it is accepted, the project keeps what it was drawn with.
    expect(stale.networkProducts?.[0]?.properties.innerDiameterMm).toBe(99);
  });

  it('takes the correction when somebody accepts it, runs included', () => {
    const commands = new ProjectCommandDispatcher(project());
    commands.dispatch(
      new SetNetworkEdgeProductCommand('water', 'e1', 'pipe-pex-16x1.5'),
    );
    const stale: Project = {
      ...commands.project,
      networkProducts: (commands.project.networkProducts ?? []).map((held) => ({
        ...held,
        version: '0.9.0',
        properties: { ...held.properties, innerDiameterMm: 99 },
      })),
      systems: (commands.project.systems ?? []).map((network) => ({
        ...network,
        edges: network.edges.map((edge) => ({
          ...edge,
          productVersion: '0.9.0',
        })),
      })),
    };
    const updated = withUpdatedNetworkProduct(stale, 'pipe-pex-16x1.5');
    expect(updated.networkProducts?.[0]?.version).toBe('1.0.0');
    expect(updated.systems?.[0]?.edges[0]?.productVersion).toBe('1.0.0');
    expect(networkProductUpdates(updated)).toEqual([]);
  });
});
