import { describe, expect, it } from 'vitest';
import type {
  Project,
  TechnicalNetwork,
} from '@house-technical-designer/core-domain';
import {
  createPreReferenceClimate,
  createPreReferenceProject,
} from './pre-reference-fixture.js';
import { createProjectCalculationContext } from './project-context.js';
import { buildProjectCalculationInputs } from './project-inputs.js';

/**
 * The same system a second time, with every identifier suffixed.
 *
 * A house can hold two water systems, two ventilation units or two boards. The
 * copy is deliberately identical in substance so that anything the inputs
 * report twice is a network genuinely taken into account, and anything they
 * report once is a network silently ignored.
 */
function duplicated(
  network: TechnicalNetwork,
  suffix: string,
): TechnicalNetwork {
  const rename = (id: string): string => `${id}${suffix}`;
  return {
    ...network,
    id: rename(network.id),
    nodes: network.nodes.map((node) => ({ ...node, id: rename(node.id) })),
    ports: network.ports.map((port) => ({
      ...port,
      id: rename(port.id),
      nodeId: rename(port.nodeId),
    })),
    edges: network.edges.map((edge) => ({
      ...edge,
      id: rename(edge.id),
      fromPortId: rename(edge.fromPortId),
      toPortId: rename(edge.toPortId),
    })),
  };
}

function twiceEverySystem(): Project {
  const project = structuredClone(createPreReferenceProject().project);
  const systems = project.systems ?? [];
  return {
    ...project,
    systems: [
      ...systems,
      ...systems.map((network) => duplicated(network, '-b')),
    ],
  };
}

function inputs(project: Project) {
  return buildProjectCalculationInputs(
    createProjectCalculationContext(project, {
      climate: createPreReferenceClimate(),
    }),
  ).inputs;
}

function rows(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  return Array.isArray(value)
    ? (value.filter(
        (entry) => typeof entry === 'object' && entry !== null,
      ) as readonly Readonly<Record<string, unknown>>[])
    : [];
}

function ids(value: unknown): readonly string[] {
  return rows(value).map((entry) => String(entry.id));
}

describe('several networks of one discipline', () => {
  it('sizes the pipes of every water system, not only the first', () => {
    const single = inputs(structuredClone(createPreReferenceProject().project));
    const both = inputs(twiceEverySystem());
    const water = both.water as Record<string, unknown>;
    expect(ids(water.segments)).toEqual(['water:pipe', 'water:pipe-b']);
    expect(ids((single.water as Record<string, unknown>).segments)).toEqual([
      'water:pipe',
    ]);
    expect(water.networkIds).toEqual(['water', 'water-b']);
    // Each segment says which system it belongs to, so a result can be read
    // back to the installation it describes.
    expect(rows(water.segments).map((entry) => entry.networkId)).toEqual([
      'water',
      'water-b',
    ]);
  });

  it('keeps the demand of each system inside that system', () => {
    const both = inputs(twiceEverySystem());
    const segments = rows((both.water as Record<string, unknown>).segments);
    // Two identical systems: the shared pipe of each carries one sink, not two.
    expect(segments.map((entry) => entry.cumulatedDesignFlowLps)).toEqual([
      0.2, 0.2,
    ]);
  });

  it('assesses the ducts and the terminals of every ventilation unit', () => {
    const both = inputs(twiceEverySystem());
    const ventilation = both.ventilation as Record<string, unknown>;
    expect(ids(ventilation.segments)).toEqual([
      'ventilation:duct',
      'ventilation:duct-b',
    ]);
    expect(ventilation.networkIds).toEqual(['ventilation', 'ventilation-b']);
    expect(ids(ventilation.terminals).length).toBe(
      new Set(ids(ventilation.terminals)).size,
    );
  });

  it('drains every wastewater system to its own outlet', () => {
    const both = inputs(twiceEverySystem());
    const wastewater = both.wastewater as Record<string, unknown>;
    expect(wastewater.networkIds).toEqual(['wastewater', 'wastewater-b']);
    expect(ids(wastewater.edges)).toEqual([
      'wastewater:pipe',
      'wastewater:pipe-b',
    ]);
    expect(ids(wastewater.nodes).length).toBe(
      new Set(ids(wastewater.nodes)).size,
    );
  });

  it('places the luminaires of every electrical board', () => {
    const both = inputs(twiceEverySystem());
    const lighting = both.lighting as Record<string, unknown>;
    const placements = ids(lighting.placements);
    expect(placements.length).toBe(new Set(placements).size);
    expect(placements.some((id) => id.endsWith('-b'))).toBe(true);
  });

  it('adds the flows a space receives from two ventilation units', () => {
    const single = inputs(structuredClone(createPreReferenceProject().project));
    const both = inputs(twiceEverySystem());
    const flowOf = (built: Record<string, unknown>): number => {
      const rooms = rows((built.iaq as Record<string, unknown>).rooms);
      return Number(rooms[0]?.supplyFlowM3h ?? 0);
    };
    expect(flowOf(both)).toBeCloseTo(flowOf(single) * 2, 6);
  });
});
