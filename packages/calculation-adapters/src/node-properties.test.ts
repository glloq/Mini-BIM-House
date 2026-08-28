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

/**
 * Le même nœud, ses valeurs remises **sur** le nœud.
 *
 * C'est la forme des fichiers écrits avant que `properties` existe, et le
 * lecteur doit continuer à la comprendre. L'empreinte partagée, elle, est
 * désormais canonique — un schéma fermé ne tolère plus qu'un nœud porte des
 * champs que le modèle ne déclare pas — donc l'ancienne forme se fabrique ici
 * plutôt que de se subir là-bas.
 */
function flattenedOntoNode(network: TechnicalNetwork): TechnicalNetwork {
  return {
    ...network,
    nodes: network.nodes.map((node) => {
      const { properties, ...core } = node;
      if (properties === undefined) return node;
      return { ...core, ...properties };
    }),
  };
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
    const project = base();
    const legacy: Project = {
      ...project,
      systems: (project.systems ?? []).map(flattenedOntoNode),
    };
    // Le débit est écrit sur le nœud lui-même, comme avant `properties`.
    expect(legacy.systems?.[0]?.nodes[1]?.properties).toBeUndefined();
    expect(flowsOf(inputs(legacy))).toEqual([0.2]);
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

describe('what the adapters refuse to assume', () => {
  it('reports a cable whose conductor material nobody stated', () => {
    const source = base();
    const stripped: Project = {
      ...source,
      systems: (source.systems ?? []).map((network) =>
        network.discipline !== 'ELECTRICAL'
          ? network
          : {
              ...network,
              edges: network.edges.map((edge) => ({
                ...edge,
                properties: { conductorSectionMm2: 1.5 },
              })),
            },
      ),
    };
    // Copper is the common case, which is exactly why choosing it silently
    // would never be noticed.
    expect(
      inputs(stripped)
        .missing.filter(({ moduleId }) => moduleId === 'electrical')
        .map(({ key }) => key),
    ).toContain('cables/electrical:feeder/conductorMaterial');
  });

  it('writes down that a segment was sized without any fitting', () => {
    const source = base();
    const stripped: Project = {
      ...source,
      systems: (source.systems ?? []).map((network) =>
        network.discipline !== 'WATER'
          ? network
          : {
              ...network,
              edges: network.edges.map((edge) => ({
                ...edge,
                properties: { internalDiameterM: 0.0166 },
              })),
            },
      ),
    };
    const built = buildProjectCalculationInputs(
      createProjectCalculationContext(stripped, {
        climate: createPreReferenceClimate(),
      }),
    );
    // Not a missing input — a hypothesis, recorded so it travels with the
    // result instead of hiding inside the number.
    expect(
      built.missing.some(({ key }) => key.endsWith('localLossCoefficient')),
    ).toBe(false);
    const water = (
      built.inputs.water as {
        readonly segments: readonly { readonly localLossCoefficient: number }[];
      }
    ).segments;
    expect(water[0]?.localLossCoefficient).toBe(0);
  });

  it('asks a rectangular duct for its two sides, not for a diameter', () => {
    const source = base();
    const rectangular: Project = {
      ...source,
      systems: (source.systems ?? []).map((network) =>
        network.discipline !== 'VENTILATION'
          ? network
          : {
              ...network,
              edges: network.edges.map((edge) => ({
                ...edge,
                properties: { airRole: 'EXTRACT', shape: 'RECTANGULAR' },
              })),
            },
      ),
    };
    const missing = inputs(rectangular)
      .missing.filter(({ moduleId }) => moduleId === 'ventilation')
      .map(({ key }) => key);
    expect(missing.some((key) => key.endsWith('widthM'))).toBe(true);
    expect(missing.some((key) => key.endsWith('diameterM'))).toBe(false);
  });

  it('sizes a rectangular duct once both sides are stated', () => {
    const source = base();
    const rectangular: Project = {
      ...source,
      systems: (source.systems ?? []).map((network) =>
        network.discipline !== 'VENTILATION'
          ? network
          : {
              ...network,
              edges: network.edges.map((edge) => ({
                ...edge,
                properties: {
                  airRole: 'EXTRACT',
                  shape: 'RECTANGULAR',
                  widthM: 0.2,
                  heightM: 0.1,
                  roughnessM: 0.00009,
                },
              })),
            },
      ),
    };
    expect(
      inputs(rectangular).missing.some(
        ({ moduleId, key }) =>
          moduleId === 'ventilation' && key.includes('segments/'),
      ),
    ).toBe(false);
  });
});
