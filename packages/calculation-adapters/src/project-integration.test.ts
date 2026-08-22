import { describe, expect, it } from 'vitest';
import { CalculationOrchestrator } from '@house-technical-designer/calculation-core';
import { applyProjectScenario } from '@house-technical-designer/project-io';
import type { Project } from '@house-technical-designer/core-domain';
import { PROJECT_CALCULATION_MODULES } from './modules.js';
import {
  createPreReferenceClimate,
  createPreReferenceProject,
} from './pre-reference-fixture.js';
import { createProjectCalculationContext } from './project-context.js';
import { buildProjectCalculationInputs } from './project-inputs.js';
import { METHOD_DEFAULTS, PHYSICAL_CONSTANTS } from './calculation-settings.js';

function project(): Project {
  return structuredClone(createPreReferenceProject().project);
}

function build(source: Project, climate = createPreReferenceClimate()) {
  return buildProjectCalculationInputs(
    createProjectCalculationContext(source, { climate }),
  );
}

function engine(): CalculationOrchestrator {
  const orchestrator = new CalculationOrchestrator();
  PROJECT_CALCULATION_MODULES.forEach((module) =>
    orchestrator.register(module),
  );
  return orchestrator;
}

describe('project calculation context', () => {
  it('derives space geometry, networks and equipment from the project', () => {
    const context = createProjectCalculationContext(project(), {
      climate: createPreReferenceClimate(),
    });
    expect(context.spaces[0]).toMatchObject({
      spaceId: 'space',
      floorAreaM2: 20,
      heightM: 2.5,
      volumeM3: 50,
    });
    expect(Object.keys(context.networksByDiscipline).sort()).toEqual([
      'ELECTRICAL',
      'VENTILATION',
      'WASTEWATER',
      'WATER',
    ]);
    expect(Object.keys(context.equipmentByKind).sort()).toEqual([
      'BATTERY',
      'DHW_TANK',
      'FAN',
      'LUMINAIRE',
      'PHOTOVOLTAIC',
      'RAINWATER_TANK',
      // A window is a catalogue entry too: it is bought whole and states the
      // transmittance the envelope reads.
      'WINDOW',
    ]);
    expect(context.quantities.length).toBeGreaterThan(0);
  });

  it('selects the primary dataset by climate profile and the hourly one for dispatch', () => {
    const context = createProjectCalculationContext(project(), {
      climate: createPreReferenceClimate(),
    });
    expect(context.climate?.datasetId).toBe('fixture-climate');
    expect(context.climate?.resolution).toBe('MONTHLY');
    expect(context.subDailyClimate?.datasetId).toBe(
      'fixture-climate-design-day',
    );
    expect(context.climate?.minimumAirTemperatureC).toBe(4);
  });
});

describe('calculation input provenance', () => {
  it('names an origin and a source for every resolved input', () => {
    const built = build(project());
    expect(built.missing).toEqual([]);
    const origins = new Set(built.provenance.map(({ origin }) => origin));
    expect([...origins].sort()).toEqual(
      expect.arrayContaining([
        'CLIMATE_DATASET',
        'EQUIPMENT',
        'METHOD_DEFAULT',
        'MODULE_SETTINGS',
        'PROJECT',
      ]),
    );
  });

  it('reports a hypothesis the project does not declare instead of assuming one', () => {
    const withoutIndoorTemperature = project();
    const heating = withoutIndoorTemperature.calculationSettings!.heating;
    (
      withoutIndoorTemperature.calculationSettings as Record<string, unknown>
    ).heating = { ...heating, settings: {} };
    const built = build(withoutIndoorTemperature);
    const missing = built.missing.filter(
      ({ moduleId }) => moduleId === 'heating',
    );
    expect(missing.map(({ key }) => key)).toContain('designIndoorTemperatureC');
    expect(missing[0]?.expectedOrigin).toBe('MODULE_SETTINGS');
    expect(built.inputs.heating).not.toHaveProperty('designIndoorTemperatureC');
  });

  it('reports the climate dataset when it is absent rather than inventing weather', () => {
    const built = build(project(), []);
    const modules = new Set(built.missing.map(({ moduleId }) => moduleId));
    expect(modules).toContain('photovoltaic');
    expect(modules).toContain('rainwater');
    expect(
      built.missing
        .filter(({ moduleId }) => moduleId === 'photovoltaic')
        .map(({ expectedOrigin }) => expectedOrigin),
    ).toContain('CLIMATE_DATASET');
  });

  it('refuses to calculate a module whose inputs stayed unknown', async () => {
    const withoutPv: Project = {
      ...project(),
      equipment: createPreReferenceProject().project.equipment!.filter(
        ({ kind }) => kind !== 'PHOTOVOLTAIC',
      ),
    };
    const built = build(withoutPv);
    expect(built.missing.map(({ key }) => key)).toContain('installedPowerWp');
    const result = await engine().calculateModule(
      'photovoltaic',
      built.inputs,
      {},
    );
    expect(result).toMatchObject({ status: 'ERROR', code: 'INVALID_INPUT' });
  });

  it('declares every conventional constant it uses', async () => {
    const result = await engine().calculateModule(
      'thermal',
      build(project()).inputs,
      {},
    );
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    const byId = new Map(
      result.result.assumptions.map(({ id, value }) => [id, value]),
    );
    expect(byId.get('insideSurfaceResistanceM2KW')).toBe(
      METHOD_DEFAULTS.thermal.insideSurfaceResistanceM2KW.value,
    );
    expect(
      result.result.assumptions.every(({ source }) => (source ?? '') !== ''),
    ).toBe(true);
  });

  it('lets project settings override a method constant, still declaring it', () => {
    const overridden = project();
    (
      overridden.calculationSettings as Record<string, { settings: unknown }>
    ).thermal = {
      moduleId: 'thermal',
      moduleVersion: '2.0.0',
      methodId: 'assembly-u-value-v1',
      settings: { insideSurfaceResistanceM2KW: 0.1 },
    } as never;
    const built = build(overridden);
    expect(
      (built.inputs.thermal as { insideSurfaceResistanceM2KW: number })
        .insideSurfaceResistanceM2KW,
    ).toBe(0.1);
    expect(
      built.provenance.find(
        ({ moduleId, key }) =>
          moduleId === 'thermal' && key === 'insideSurfaceResistanceM2KW',
      )?.origin,
    ).toBe('MODULE_SETTINGS');
  });

  it('exposes the physical constants it relies on', () => {
    expect(PHYSICAL_CONSTANTS.airDensityKgM3.reference).toContain('Dry air');
    const constants: readonly { sourceId: string; reference: string }[] =
      Object.values(PHYSICAL_CONSTANTS);
    expect(
      constants.every(
        ({ sourceId, reference }) =>
          sourceId.length > 0 && reference.length > 0,
      ),
    ).toBe(true);
  });
});

describe('scenario driven calculation', () => {
  it('recalculates a variant from the same project without duplicating it', async () => {
    const base = project();
    const variant = applyProjectScenario(base, 'scenario-insulation-plus');
    expect(variant.status).toBe('OK');
    if (variant.status !== 'OK') return;
    const [baseHeating, variantHeating] = await Promise.all([
      engine().calculateModule('heating', build(base).inputs, {}),
      engine().calculateModule('heating', build(variant.project).inputs, {}),
    ]);
    expect(baseHeating.status).toBe('OK');
    expect(variantHeating.status).toBe('OK');
    if (baseHeating.status !== 'OK' || variantHeating.status !== 'OK') return;
    expect(variantHeating.result.outputs.designLoadW).toBeLessThan(
      baseHeating.result.outputs.designLoadW as number,
    );
    expect(base.assemblies?.[0]?.layers[0]?.thicknessM).toBe(0.2);
  });
});
