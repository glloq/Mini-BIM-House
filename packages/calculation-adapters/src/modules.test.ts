import { describe, expect, it } from 'vitest';
import { CalculationOrchestrator } from '@house-technical-designer/calculation-core';
import {
  loadProjectJson,
  serializeProjectFile,
} from '@house-technical-designer/project-io';
import type { Project } from '@house-technical-designer/core-domain';
import { PROJECT_CALCULATION_MODULES } from './modules.js';
import {
  createPreReferenceClimate,
  createPreReferenceProject,
} from './pre-reference-fixture.js';
import { createProjectCalculationContext } from './project-context.js';
import {
  buildProjectCalculationInputs,
  PROJECT_CALCULATION_MODULE_IDS,
} from './project-inputs.js';
import { simulateRainwater } from '@house-technical-designer/rainwater';
import {
  evaluateRule,
  RuleFunctionRegistry,
  type RuleDefinition,
} from '@house-technical-designer/rule-engine';

function orchestrator(): CalculationOrchestrator {
  const result = new CalculationOrchestrator();
  PROJECT_CALCULATION_MODULES.forEach((module) => result.register(module));
  return result;
}

/** Builds every module input from the fixture project, never from literals. */
function projectInputs(mutate?: (project: Project) => void) {
  const project = structuredClone(createPreReferenceProject().project);
  mutate?.(project);
  const context = createProjectCalculationContext(project, {
    climate: createPreReferenceClimate(),
  });
  return buildProjectCalculationInputs(context);
}

async function run(moduleId: string, mutate?: (project: Project) => void) {
  const built = projectInputs(mutate);
  const result = await orchestrator().calculateModule(
    moduleId,
    built.inputs,
    {},
  );
  expect(result.status, JSON.stringify(result)).toBe('OK');
  if (result.status !== 'OK') throw new Error(result.message);
  return result.result;
}

describe('real calculation orchestration adapters', () => {
  it('preserves rainwater capacity monotonicity and mass conservation', () => {
    const climate = {
      id: 'climate',
      location: { latitude: 48, longitude: 2, timezone: 'UTC' },
      resolution: 'DAILY' as const,
      source: { id: 'fixture', provider: 'TEST' },
      samples: [
        { timestamp: '2026-01-01', precipitationMm: 10 },
        { timestamp: '2026-01-02', precipitationMm: 0 },
      ],
    };
    const run = (nominalVolumeL: number) =>
      simulateRainwater({
        climate,
        surfaces: [
          {
            surfaceId: 'roof',
            projectedAreaM2: 10,
            runoffCoefficient: 1,
            preFilterEfficiency: 1,
            enabled: true,
          },
        ],
        demands: [{ useType: 'WC', demandSeriesL: [20, 20] }],
        mainsTopUpSeriesL: [0, 0],
        tank: { nominalVolumeL, initialVolumeL: 0 },
      });
    const small = run(20);
    const large = run(100);
    expect(large.indicators!.servedL).toBeGreaterThanOrEqual(
      small.indicators!.servedL,
    );
    for (const result of [small, large]) {
      const final = result.steps.at(-1)!.storageL;
      const totals = result.indicators!;
      expect(totals.collectedL).toBeCloseTo(
        final + totals.servedL + totals.overflowL,
        9,
      );
    }
  });

  it('evaluates all four rule states on the pre-reference domain object', () => {
    const project = createPreReferenceProject().project;
    const definition = (
      expression: RuleDefinition['evaluator'],
    ): RuleDefinition => ({
      id: 'fixture-rule',
      severity: 'ERROR',
      appliesTo: 'Wall',
      evaluator: expression,
    });
    const registry = new RuleFunctionRegistry();
    registry.register({
      id: 'fixture.notApplicable',
      version: '1',
      evaluate: () => ({ status: 'NOT_APPLICABLE' }),
    });
    const context = {
      objectIds: [project.building.levels[0]!.walls[0]!.id],
      data: { wallCount: project.building.levels[0]!.walls.length },
    };
    const statuses = [
      evaluateRule(
        definition({
          type: 'DECLARATIVE',
          expression: { op: 'gte', path: 'wallCount', value: 1 },
        }),
        context,
        {},
        registry,
      ).status,
      evaluateRule(
        definition({
          type: 'DECLARATIVE',
          expression: { op: 'gt', path: 'wallCount', value: 5 },
        }),
        context,
        {},
        registry,
      ).status,
      evaluateRule(
        definition({
          type: 'DECLARATIVE',
          expression: { op: 'gte', path: 'missing', value: 1 },
        }),
        context,
        {},
        registry,
      ).status,
      evaluateRule(
        definition({
          type: 'MODULE_FUNCTION',
          functionId: 'fixture.notApplicable',
        }),
        context,
        {},
        registry,
      ).status,
    ];
    expect(statuses).toEqual(['PASS', 'FAIL', 'UNKNOWN', 'NOT_APPLICABLE']);
  });

  it('keeps the populated pre-reference project canonical across persistence', () => {
    const serialized = serializeProjectFile(createPreReferenceProject());
    const loaded = loadProjectJson(serialized);
    expect(loaded.status).toBe('OK');
    if (loaded.status === 'OK')
      expect(serializeProjectFile(loaded.file)).toBe(serialized);
  });
  it('resolves every module input from the project without leftovers', () => {
    const built = projectInputs();
    expect(built.missing, JSON.stringify(built.missing)).toEqual([]);
    expect(Object.keys(built.inputs).sort()).toEqual(
      [...PROJECT_CALCULATION_MODULE_IDS].sort(),
    );
    // Every resolved input names where it came from.
    expect(built.provenance.length).toBeGreaterThan(20);
    expect(
      built.provenance.every(
        ({ origin, sourceId }) => origin !== undefined && sourceId !== '',
      ),
    ).toBe(true);
  });

  it('runs thermal → heating and insulation monotonicity', async () => {
    const first = await run('heating');
    const insulated = await run('heating', (project) => {
      const layer = project.assemblies![0]!.layers[0]! as {
        thicknessM: number;
      };
      layer.thicknessM = 0.4;
    });
    expect(insulated.outputs.designLoadW).toBeLessThan(
      first.outputs.designLoadW as number,
    );
  });

  it('counts a luminaire drawn on the plan, not only one wired to a circuit', () => {
    // The lighting calculation read the electrical network alone, so a
    // luminaire placed on the plan lit nothing: the building had to be drawn
    // twice for it to count.
    const before = projectInputs().inputs.lighting as {
      placements: readonly unknown[];
    };
    const after = projectInputs((project) => {
      const level = project.building.levels[0]!;
      const luminaire = (project.equipment ?? []).find(
        ({ kind }) => kind === 'LUMINAIRE',
      )!;
      (level as unknown as { components?: unknown[] }).components = [
        ...(level.components ?? []),
        {
          id: 'lamp-on-the-plan',
          type: 'COMPONENT_INSTANCE',
          levelId: level.id,
          category: 'LIGHTING',
          definitionId: luminaire.id,
          position: { x: 1000, y: 1000 },
          elevationMm: 2400,
          rotationDeg: 0,
          spaceId: level.spaces[0]!.id,
        },
      ];
    }).inputs.lighting as {
      placements: readonly { readonly id: string }[];
    };
    expect(after.placements.length).toBe(before.placements.length + 1);
    expect(after.placements.some(({ id }) => id === 'lamp-on-the-plan')).toBe(
      true,
    );
  });

  it('counts a luminaire once when a node already stands for it', () => {
    // A node that names the placed object it feeds is the same luminaire, not
    // a second one.
    const doubled = projectInputs((project) => {
      const level = project.building.levels[0]!;
      const luminaire = (project.equipment ?? []).find(
        ({ kind }) => kind === 'LUMINAIRE',
      )!;
      (level as unknown as { components?: unknown[] }).components = [
        ...(level.components ?? []),
        {
          id: 'lamp-wired',
          type: 'COMPONENT_INSTANCE',
          levelId: level.id,
          category: 'LIGHTING',
          definitionId: luminaire.id,
          position: { x: 1000, y: 1000 },
          elevationMm: 2400,
          rotationDeg: 0,
        },
      ];
      for (const network of project.systems ?? [])
        if (network.discipline === 'ELECTRICAL')
          (network as unknown as { nodes: unknown[] }).nodes =
            network.nodes.map((node) =>
              node.kind === 'LUMINAIRE'
                ? { ...node, componentId: 'lamp-wired' }
                : node,
            );
    }).inputs.lighting as { placements: readonly { readonly id: string }[] };
    expect(
      doubled.placements.filter(({ id }) => id === 'lamp-wired'),
    ).toHaveLength(0);
  });

  it('runs lighting and PV → battery → energy with unique uses and conservation', async () => {
    const result = await run('energy-balance');
    expect(Object.keys(result.outputs.totalByUsageWh as object).sort()).toEqual(
      ['DHW', 'HEATING', 'LIGHTING', 'VENTILATION'],
    );
    expect(
      Math.abs(result.outputs.conservationResidualWh as number),
    ).toBeLessThan(1e-6);
    expect(result.outputs.storageAssessed).toBe(true);
    expect(result.trace?.dependencyFingerprints.length).toBeGreaterThanOrEqual(
      4,
    );
  });

  it('rejects malformed worker-bound module input before calculation', async () => {
    await expect(
      orchestrator().calculateModule('thermal', { thermal: null }, {}),
    ).resolves.toMatchObject({ status: 'ERROR', code: 'INVALID_INPUT' });
  });

  it('preserves hydraulic and ventilation monotonic invariants', async () => {
    const narrowPipe = (project: Project) => {
      const pipe = project.systems!.find(({ id }) => id === 'water')!.edges[0]!;
      (pipe.properties as { internalDiameterM: number }).internalDiameterM =
        0.012;
    };
    const narrowDuct = (project: Project) => {
      const duct = project.systems!.find(({ id }) => id === 'ventilation')!
        .edges[0]!;
      (duct.properties as { diameterM: number }).diameterM = 0.08;
    };
    const [wideWater, tightWater, wideAir, tightAir] = await Promise.all([
      run('water'),
      run('water', narrowPipe),
      run('ventilation'),
      run('ventilation', narrowDuct),
    ]);
    const velocity = (result: { outputs: Record<string, unknown> }) =>
      (result.outputs.segments as { velocityMs: number }[])[0]!.velocityMs;
    const loss = (result: { outputs: Record<string, unknown> }) =>
      result.outputs.totalPressureLossPa as number;
    expect(velocity(tightWater)).toBeGreaterThan(velocity(wideWater));
    expect(loss(tightWater)).toBeGreaterThan(loss(wideWater));
    expect(velocity(tightAir)).toBeGreaterThan(velocity(wideAir));
    expect(loss(tightAir)).toBeGreaterThan(loss(wideAir));
  });

  it.each(PROJECT_CALCULATION_MODULE_IDS)(
    'runs %s from the project alone',
    async (moduleId) => {
      const result = await run(moduleId);
      expect(result.moduleId).toBe(moduleId);
      // Any conventional value used by a module is declared, never silent.
      for (const declared of result.assumptions)
        expect(declared.source).toBeTruthy();
    },
  );
});
