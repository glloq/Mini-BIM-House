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
import { REFERENCE_INTEGRATION_MODULES } from './modules.js';
import {
  buildProjectCalculationInputs,
  createProjectCalculationContext,
  type ProjectCalculationRunSettings,
} from './project-context.js';
import type { Project } from '@house-technical-designer/core-domain';

const fixturePath = fileURLToPath(
  new URL(
    '../../../examples/reference-house/reference.houseproj.json',
    import.meta.url,
  ),
);

const runSettings: ProjectCalculationRunSettings = {
  designDeltaK: 25,
  lightingPowerW: 72,
  irradiationWhM2: [0, 180, 650, 820, 310, 0],
  timeStepHours: 1,
};

function orchestrator(): CalculationOrchestrator {
  const engine = new CalculationOrchestrator();
  REFERENCE_INTEGRATION_MODULES.forEach((module) => engine.register(module));
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
  const result = await orchestrator().calculateModule(
    moduleId,
    buildProjectCalculationInputs(
      createProjectCalculationContext(project),
      runSettings,
    ),
    {},
  );
  expect(result.status).toBe('OK');
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
    const level = project.building.levels[0]!;
    expect(level.spaces).toHaveLength(4);
    expect(level.walls).toHaveLength(6);
    expect(project.systems?.map(({ discipline }) => discipline).sort()).toEqual(
      ['ELECTRICAL', 'VENTILATION', 'WASTEWATER', 'WATER'],
    );

    const context = createProjectCalculationContext(project);
    expect(context.exteriorWalls).toHaveLength(4);
    expect(
      context.exteriorWalls.reduce((sum, wall) => sum + wall.netAreaM2, 0),
    ).toBeCloseTo(87.87, 8);
    expect(context.roofs[0]?.projectedAreaM2).toBe(80);
    expect(context.spaces).toHaveLength(4);
    expect(context.systems).toHaveLength(4);
    expect(context.climateProfileId).toBe('reference-temperate');

    const engine = orchestrator();
    const energy = await engine.calculateModule(
      'energy-balance',
      buildProjectCalculationInputs(context, runSettings),
      {},
    );
    expect(energy.status).toBe('OK');
    if (energy.status === 'OK') {
      expect(
        Math.abs(energy.result.outputs.conservationResidualKWh as number),
      ).toBeLessThan(1e-9);
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
      9,
    );

    const largerBattery = structuredClone(baseline);
    const battery = largerBattery.equipment!.find(
      ({ kind }) => kind === 'BATTERY',
    )!;
    (battery.properties as { usableCapacityKWh: number }).usableCapacityKWh *=
      2;
    const baseDispatch = await output(baseline, 'battery');
    const changedDispatch = await output(largerBattery, 'battery');
    expect(changedDispatch.initialStoredEnergyKWh).not.toBe(
      baseDispatch.initialStoredEnergyKWh,
    );
    expect(changedDispatch.finalStoredEnergyKWh).not.toBe(
      baseDispatch.finalStoredEnergyKWh,
    );
  });
});
