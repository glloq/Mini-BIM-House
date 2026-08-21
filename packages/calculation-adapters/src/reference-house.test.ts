import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CalculationOrchestrator } from '@house-technical-designer/calculation-core';
import {
  createSemanticScene,
  drawingViewId,
  exportSemanticSceneToSvg,
  graphicProfileId,
  type DrawingView,
  type GraphicProfile,
  type ScenePrimitive,
} from '@house-technical-designer/drawing-engine';
import {
  loadProjectJson,
  serializeProjectFile,
} from '@house-technical-designer/project-io';
import type { ClimateDataset } from '@house-technical-designer/climate';
import { PROJECT_CALCULATION_MODULES } from './modules.js';
import { PROJECT_CALCULATION_MODULE_IDS } from './project-inputs.js';
import { createProjectCalculationContext } from './project-context.js';
import { buildProjectCalculationInputs } from './project-inputs.js';
import type { Project } from '@house-technical-designer/core-domain';

const fixturePath = fileURLToPath(
  new URL(
    '../../../examples/reference-house/reference.houseproj.json',
    import.meta.url,
  ),
);

const monthlyClimatePath = fileURLToPath(
  new URL(
    '../../../examples/reference-house/climate-monthly.json',
    import.meta.url,
  ),
);
const designDayClimatePath = fileURLToPath(
  new URL(
    '../../../examples/reference-house/climate-design-day.json',
    import.meta.url,
  ),
);

async function climateDatasets(): Promise<readonly ClimateDataset[]> {
  const [monthly, designDay] = await Promise.all([
    readFile(monthlyClimatePath, 'utf8'),
    readFile(designDayClimatePath, 'utf8'),
  ]);
  return [
    JSON.parse(monthly) as ClimateDataset,
    JSON.parse(designDay) as ClimateDataset,
  ];
}

function orchestrator(): CalculationOrchestrator {
  const engine = new CalculationOrchestrator();
  PROJECT_CALCULATION_MODULES.forEach((module) => engine.register(module));
  return engine;
}

async function output(
  project: Project,
  moduleId: string,
): Promise<
  Readonly<
    Record<
      string,
      import('@house-technical-designer/calculation-core').CalculationJson
    >
  >
> {
  const context = createProjectCalculationContext(project, {
    climate: await climateDatasets(),
  });
  const result = await orchestrator().calculateModule(
    moduleId,
    buildProjectCalculationInputs(context).inputs,
    {},
  );
  expect(result.status, JSON.stringify(result)).toBe('OK');
  if (result.status !== 'OK') throw new Error(result.message);
  return result.result.outputs;
}

describe('PR-069 reference house', () => {
  it('loads, calculates, saves, reloads and exports a deterministic SVG plan', async () => {
    const source = await readFile(fixturePath, 'utf8');
    const loaded = loadProjectJson(source);
    expect(loaded.status, JSON.stringify(loaded)).toBe('OK');
    if (loaded.status !== 'OK') return;

    const { project } = loaded.file;
    // Two storeys, joined by a stair: the reference house is the golden case
    // and a house of one storey exercises none of what a storey above adds.
    expect(project.building.levels.map(({ id }) => id)).toEqual([
      'ground',
      'first',
    ]);
    const level = project.building.levels[0]!;
    expect(level.spaces).toHaveLength(4);
    expect(level.walls).toHaveLength(6);
    expect(level.stairs[0]?.topLevelId).toBe('first');
    expect(project.building.levels[1]?.spaces).toHaveLength(4);
    expect(project.systems?.map(({ discipline }) => discipline).sort()).toEqual(
      ['ELECTRICAL', 'VENTILATION', 'WASTEWATER', 'WATER'],
    );

    const context = createProjectCalculationContext(project, {
      climate: await climateDatasets(),
    });
    expect(context.exteriorWalls).toHaveLength(8);
    expect(
      context.exteriorWalls.reduce((sum, wall) => sum + wall.netAreaM2, 0),
    ).toBeCloseTo(173.59, 8);
    // Two pitches meeting at a ridge, forty square metres each in plan.
    expect(context.roofs.map(({ projectedAreaM2 }) => projectedAreaM2)).toEqual(
      [40, 40],
    );
    expect(context.spaces).toHaveLength(8);
    expect(context.systems).toHaveLength(4);
    expect(context.climateProfileId).toBe('reference-temperate');
    expect(context.climate?.datasetId).toBe('reference-temperate');
    expect(context.subDailyClimate?.resolution).toBe('HOURLY');

    const built = buildProjectCalculationInputs(context);
    expect(built.missing, JSON.stringify(built.missing)).toEqual([]);
    expect(built.provenance.length).toBeGreaterThan(20);

    const engine = orchestrator();
    const energy = await engine.calculateModule(
      'energy-balance',
      built.inputs,
      {},
    );
    expect(energy.status, JSON.stringify(energy)).toBe('OK');
    if (energy.status === 'OK') {
      expect(
        Math.abs(energy.result.outputs.conservationResidualWh as number),
      ).toBeLessThan(1e-6);
      expect(energy.result.outputs.storageAssessed).toBe(true);
    }

    const serialized = serializeProjectFile(loaded.file);
    const reloaded = loadProjectJson(serialized);
    expect(reloaded.status).toBe('OK');
    if (reloaded.status === 'OK')
      expect(serializeProjectFile(reloaded.file)).toBe(serialized);

    const view: DrawingView = {
      id: drawingViewId('reference-ground-plan'),
      type: 'PLAN',
      levelId: level.id,
      scale: 50,
      viewport: { min: { x: -500, y: -500 }, max: { x: 10500, y: 8500 } },
      visibleDisciplines: ['ARCHITECTURE'],
      graphicProfileId: graphicProfileId('reference-profile'),
    };
    const primitives: ScenePrimitive[] = level.walls.map((wall) => ({
      id: `wall:${wall.id}`,
      sourceObjectId: wall.id,
      semanticRole: 'WALL_CUT',
      geometry: {
        kind: 'POLYLINE',
        polyline: { points: wall.path.points, closed: false },
      },
      layer: 'architecture.walls',
      zIndex: 10,
      discipline: 'ARCHITECTURE',
    }));
    const profile: GraphicProfile = {
      id: view.graphicProfileId,
      name: 'Reference profile',
      roleTokens: { WALL_CUT: 'wall-cut' },
    };
    const artifact = exportSemanticSceneToSvg({
      scene: createSemanticScene(view, primitives),
      view,
      profile,
      styles: {
        tokens: {
          'wall-cut': {
            stroke: '#111111',
            strokeWidthPaperMm: 0.5,
            fill: 'none',
          },
        },
      },
      fileName: 'reference-house.svg',
      metadata: {
        title: 'Maison de référence — plan du rez-de-chaussée',
        projectId: project.id,
        ...(project.metadata.projectRevision === undefined
          ? {}
          : { revision: project.metadata.projectRevision }),
      },
    });
    expect(artifact.content).toContain('data-role="WALL_CUT"');
    expect(artifact.content).not.toContain('data-selected');
    expect(artifact.byteLength).toBeGreaterThan(500);
  });

  it('propagates project insulation changes through thermal and heating', async () => {
    const loaded = loadProjectJson(await readFile(fixturePath, 'utf8'));
    expect(loaded.status).toBe('OK');
    if (loaded.status !== 'OK') return;
    const baseline = loaded.file.project;
    const changed = structuredClone(baseline);
    const exterior = changed.assemblies!.find(
      ({ id }) => id === 'assembly-exterior',
    )!;
    const insulation = exterior.layers.find(
      ({ id }) => id === 'layer-insulation',
    )!;
    (insulation as { thicknessM: number }).thicknessM *= 2;

    const baseThermal = await output(baseline, 'thermal');
    const changedThermal = await output(changed, 'thermal');
    const baseHeating = await output(baseline, 'heating');
    const changedHeating = await output(changed, 'heating');
    expect(changedThermal.uValueWm2K as number).toBeLessThan(
      baseThermal.uValueWm2K as number,
    );
    expect(changedThermal.heatTransferCoefficientWK as number).toBeLessThan(
      baseThermal.heatTransferCoefficientWK as number,
    );
    expect(changedHeating.designLoadW as number).toBeLessThan(
      baseHeating.designLoadW as number,
    );
  });

  it('holds one of everything a house is made of', async () => {
    // The golden case: if the reference house stops covering something, every
    // suite that leans on it goes on passing by having nothing to check.
    const loaded = loadProjectJson(await readFile(fixturePath, 'utf8'));
    expect(loaded.status).toBe('OK');
    if (loaded.status !== 'OK') return;
    const { project } = loaded.file;
    const levels = project.building.levels;
    expect(levels).toHaveLength(2);
    // Two storeys joined by a stair, a roof on the one it covers, a ground
    // under the house.
    expect(levels.flatMap(({ stairs }) => stairs)).toHaveLength(1);
    expect(levels.flatMap(({ roofs }) => roofs).length).toBeGreaterThan(0);
    expect(project.site.parcelBoundary).toBeDefined();
    // Things placed, not only catalogued, and networks that reach both floors.
    const components = levels.flatMap(({ components }) => components ?? []);
    expect(components.length).toBeGreaterThan(8);
    expect(new Set(components.map(({ levelId }) => levelId)).size).toBe(2);
    for (const system of project.systems ?? []) {
      expect(
        system.nodes.some(({ levelId }) => levelId === 'first'),
        system.id,
      ).toBe(true);
      // Every run says what it is made of, and the project carries its own
      // copy of that product.
      for (const edge of system.edges)
        expect(
          (project.networkProducts ?? []).some(
            ({ id }) => id === edge.productId,
          ),
          edge.id,
        ).toBe(true);
    }
    // A drawing set of every kind of view, laid out on a sheet.
    expect(
      [...new Set((project.drawingViews ?? []).map(({ type }) => type))].sort(),
    ).toEqual(['ELEVATION', 'PLAN', 'ROOF', 'SECTION', 'SITE']);
    expect(project.sheets?.[0]?.viewports.length).toBeGreaterThan(1);
  });

  it('runs every module on the reference house', async () => {
    const loaded = loadProjectJson(await readFile(fixturePath, 'utf8'));
    expect(loaded.status).toBe('OK');
    if (loaded.status !== 'OK') return;
    const context = createProjectCalculationContext(loaded.file.project, {
      climate: await climateDatasets(),
    });
    const built = buildProjectCalculationInputs(context);
    expect(built.missing).toEqual([]);
    const engine = orchestrator();
    for (const moduleId of PROJECT_CALCULATION_MODULE_IDS) {
      const result = await engine.calculateModule(moduleId, built.inputs, {});
      expect(result.status, `${moduleId}: ${JSON.stringify(result)}`).toBe(
        'OK',
      );
      if (result.status !== 'OK') continue;
      expect(result.result.status, moduleId).not.toBe('FAILED');
    }
  });

  it('propagates project PV power and battery capacity changes', async () => {
    const loaded = loadProjectJson(await readFile(fixturePath, 'utf8'));
    expect(loaded.status).toBe('OK');
    if (loaded.status !== 'OK') return;
    const baseline = loaded.file.project;
    const morePv = structuredClone(baseline);
    const pv = morePv.equipment!.find(({ kind }) => kind === 'PHOTOVOLTAIC')!;
    (pv.properties as { installedPowerWp: number }).installedPowerWp *= 2;
    const basePv = await output(baseline, 'photovoltaic');
    const changedPv = await output(morePv, 'photovoltaic');
    expect((changedPv.generationWh as number[])[2]).toBeCloseTo(
      (basePv.generationWh as number[])[2]! * 2,
      6,
    );

    const largerBattery = structuredClone(baseline);
    const battery = largerBattery.equipment!.find(
      ({ kind }) => kind === 'BATTERY',
    )!;
    (battery.properties as { usableCapacityKWh: number }).usableCapacityKWh *=
      2;
    const baseLedger = await output(baseline, 'energy-balance');
    const changedLedger = await output(largerBattery, 'energy-balance');
    expect(changedLedger.finalStoredEnergyKWh).not.toBe(
      baseLedger.finalStoredEnergyKWh,
    );
    expect(changedLedger.selfSufficiencyRatio as number).toBeGreaterThanOrEqual(
      baseLedger.selfSufficiencyRatio as number,
    );
  });
});
