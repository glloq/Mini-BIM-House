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

function inputs(project: Project) {
  return buildProjectCalculationInputs(
    createProjectCalculationContext(project, {
      climate: createPreReferenceClimate(),
    }),
  );
}

function base(): Project {
  return structuredClone(createPreReferenceProject().project);
}

/** The same node value, stated in the record instead of on the node. */
function movedIntoProperties(network: TechnicalNetwork): TechnicalNetwork {
  const core = new Set([
    'id',
    'kind',
    'position',
    'hostObjectId',
    'spaceId',
    'equipmentId',
    'properties',
  ]);
  return {
    ...network,
    nodes: network.nodes.map((node) => {
      const entries = Object.entries(
        node as unknown as Record<string, unknown>,
      ).filter(([key]) => !core.has(key));
      if (entries.length === 0) return node;
      const kept = Object.fromEntries(
        Object.entries(node as unknown as Record<string, unknown>).filter(
          ([key]) => core.has(key),
        ),
      );
      return {
        ...(kept as unknown as TechnicalNetwork['nodes'][number]),
        properties: Object.fromEntries(entries) as Record<string, never>,
      };
    }),
  };
}

const flowsOf = (built: ReturnType<typeof inputs>): readonly unknown[] =>
  ((built.inputs.water as Record<string, unknown>).segments as unknown[]).map(
    (segment) => (segment as Record<string, unknown>).cumulatedDesignFlowLps,
  );

describe('where a node states its properties', () => {
  it('reads the property record the editor writes', () => {
    const project = base();
    const declared: Project = {
      ...project,
      systems: (project.systems ?? []).map(movedIntoProperties),
    };
    expect(declared.systems?.[0]?.nodes[1]?.properties).toMatchObject({
      designFlowLps: 0.2,
    });
    expect(flowsOf(inputs(declared))).toEqual(flowsOf(inputs(project)));
  });

  it('still reads a file written before that record existed', () => {
    // The fixture states the flow as a field of the node itself.
    const project = base();
    expect(project.systems?.[0]?.nodes[1]?.properties).toBeUndefined();
    expect(flowsOf(inputs(project))).toEqual([0.2]);
  });

  it('reports a diameter nobody stated instead of choosing one', () => {
    const project = base();
    const stripped: Project = {
      ...project,
      systems: (project.systems ?? []).map((network) => ({
        ...network,
        edges: network.edges.map(({ properties: _dropped, ...edge }) => edge),
      })),
    };
    const missing = inputs(stripped).missing.filter(
      ({ moduleId }) => moduleId === 'water',
    );
    expect(missing.map(({ key }) => key)).toContain(
      'segments/water:pipe/internalDiameterM',
    );
  });
});
