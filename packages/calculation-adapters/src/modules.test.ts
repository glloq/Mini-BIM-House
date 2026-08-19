import { describe, expect, it } from 'vitest';
import { CalculationOrchestrator } from '@house-technical-designer/calculation-core';
import {
  loadProjectJson,
  serializeProjectFile,
} from '@house-technical-designer/project-io';
import { REFERENCE_INTEGRATION_MODULES } from './modules.js';
import { createPreReferenceProject } from './pre-reference-fixture.js';
import { simulateRainwater } from '@house-technical-designer/rainwater';
import {
  evaluateRule,
  RuleFunctionRegistry,
  type RuleDefinition,
} from '@house-technical-designer/rule-engine';

const inputs = {
  thermal: {
    elements: [
      {
        id: 'wall',
        areaM2: 100,
        layers: [
          {
            layerId: 'layer',
            materialId: 'material',
            thicknessM: 0.2,
            lambdaWmK: 0.04,
          },
        ],
      },
    ],
  },
  heating: { designDeltaK: 25 },
  lighting: { powerW: 100 },
  photovoltaic: { installedPowerWp: 4000, irradiationWhM2: [500, 800, 200] },
  battery: { hours: 1, usableCapacityKWh: 5 },
  'energy-balance': {},
} as const;
function orchestrator(): CalculationOrchestrator {
  const result = new CalculationOrchestrator();
  REFERENCE_INTEGRATION_MODULES.forEach((module) => result.register(module));
  return result;
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
  it('runs thermal → heating and insulation monotonicity', async () => {
    const engine = orchestrator();
    const first = await engine.calculateModule('heating', inputs, {});
    const insulated = await engine.calculateModule(
      'heating',
      {
        ...inputs,
        thermal: {
          elements: inputs.thermal.elements.map((element) => ({
            ...element,
            layers: element.layers.map((layer) => ({
              ...layer,
              thicknessM: 0.4,
            })),
          })),
        },
      },
      {},
    );
    expect(first.status).toBe('OK');
    expect(insulated.status).toBe('OK');
    if (first.status === 'OK' && insulated.status === 'OK') {
      expect(insulated.result.outputs.designLoadW).toBeLessThan(
        first.result.outputs.designLoadW as number,
      );
    }
  });

  it('runs lighting and PV → battery → energy with unique uses and conservation', async () => {
    const result = await orchestrator().calculateModule(
      'energy-balance',
      inputs,
      {},
    );
    expect(result.status).toBe('OK');
    if (result.status === 'OK') {
      expect(result.result.outputs.energyUseIds).toEqual([
        'heating:electricity',
        'lighting:electricity',
      ]);
      expect(
        Math.abs(result.result.outputs.conservationResidualKWh as number),
      ).toBeLessThan(1e-9);
      expect(result.result.trace?.dependencyFingerprints).toHaveLength(1);
    }
  });

  it('rejects malformed worker-bound module input before calculation', async () => {
    await expect(
      orchestrator().calculateModule('thermal', { thermal: null }, {}),
    ).resolves.toMatchObject({ status: 'ERROR', code: 'INVALID_INPUT' });
  });

  it('preserves hydraulic and ventilation monotonic invariants', async () => {
    const engine = orchestrator();
    const wideWater = await engine.calculateModule(
      'water',
      { water: { lengthM: 10, diameterM: 0.03, flowM3s: 0.0005 } },
      {},
    );
    const narrowWater = await engine.calculateModule(
      'water',
      { water: { lengthM: 10, diameterM: 0.02, flowM3s: 0.0005 } },
      {},
    );
    const wideDuct = await engine.calculateModule(
      'ventilation',
      { ventilation: { diameterM: 0.2, flowM3h: 100 } },
      {},
    );
    const narrowDuct = await engine.calculateModule(
      'ventilation',
      { ventilation: { diameterM: 0.1, flowM3h: 100 } },
      {},
    );
    for (const result of [wideWater, narrowWater, wideDuct, narrowDuct])
      expect(result.status).toBe('OK');
    if (wideWater.status === 'OK' && narrowWater.status === 'OK') {
      expect(narrowWater.result.outputs.velocityMs).toBeGreaterThan(
        wideWater.result.outputs.velocityMs as number,
      );
      expect(narrowWater.result.outputs.pressureLossPa).toBeGreaterThan(
        wideWater.result.outputs.pressureLossPa as number,
      );
    }
    if (wideDuct.status === 'OK' && narrowDuct.status === 'OK') {
      expect(narrowDuct.result.outputs.velocityMs).toBeGreaterThan(
        wideDuct.result.outputs.velocityMs as number,
      );
      expect(narrowDuct.result.outputs.pressureLossPa).toBeGreaterThan(
        wideDuct.result.outputs.pressureLossPa as number,
      );
    }
  });

  it.each([
    ['rainwater', { precipitationMm: 10, areaM2: 100 }],
    ['wastewater', { endElevationMm: 0 }],
    ['iaq', { volumeM3: 125, flowM3h: 100 }],
    ['hygrothermal', { resistanceM2KW: 5 }],
    ['acoustics', { absorption: 0.3 }],
    ['dhw', { dailyVolumeL: 100 }],
    ['cost', { quantity: 100, price: 25 }],
    ['environmental', { quantity: 100, impact: 5 }],
  ] as const)(
    'runs the real independent %s kernel',
    async (moduleId, input) => {
      await expect(
        orchestrator().calculateModule(moduleId, { [moduleId]: input }, {}),
      ).resolves.toMatchObject({ status: 'OK' });
    },
  );
});
