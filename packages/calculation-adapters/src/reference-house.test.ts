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

const fixturePath = fileURLToPath(
  new URL(
    '../../../examples/reference-house/reference.houseproj.json',
    import.meta.url,
  ),
);

const calculationInputs = {
  thermal: { areaM2: 160, thicknessM: 0.2, lambdaWmK: 0.04 },
  heating: { designDeltaK: 25 },
  lighting: { powerW: 72 },
  photovoltaic: {
    installedPowerWp: 4000,
    irradiationWhM2: [0, 180, 650, 820, 310, 0],
  },
  battery: { hours: 1 },
  'energy-balance': {},
} as const;

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

    const engine = new CalculationOrchestrator();
    REFERENCE_INTEGRATION_MODULES.forEach((module) => engine.register(module));
    const energy = await engine.calculateModule(
      'energy-balance',
      calculationInputs,
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
});
