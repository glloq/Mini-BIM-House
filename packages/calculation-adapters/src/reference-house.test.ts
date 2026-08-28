import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { equipmentKindOf } from '@house-technical-designer/core-domain';
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
} from '@house-technical-designer/project-io/files';
import type { ClimateDataset } from '@house-technical-designer/climate';
import { PROJECT_CALCULATION_MODULES } from './modules.js';
import { PROJECT_CALCULATION_MODULE_IDS } from './project-inputs.js';
import { createProjectCalculationContext } from './project-context.js';
import { buildProjectCalculationInputs } from './project-inputs.js';
import type { Project } from '@house-technical-designer/core-domain';
import { entityId } from '@house-technical-designer/core-domain';
import type { Point2D } from '@house-technical-designer/geometry';

/** Whether a point falls inside a polygon, by the even–odd rule. */
function within(point: Point2D, outer: readonly Point2D[]): boolean {
  let inside = false;
  for (let index = 0; index < outer.length; index += 1) {
    const a = outer[index]!;
    const b = outer[(index + 1) % outer.length]!;
    if (a.y > point.y === b.y > point.y) continue;
    const crossing = a.x + ((point.y - a.y) * (b.x - a.x)) / (b.y - a.y);
    if (point.x < crossing) inside = !inside;
  }
  return inside;
}

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
      ({ id }) => id === 'generic-wall-block-external-insulation',
    )!;
    // Its insulating layer, whatever the build-up calls it: the catalogue's
    // external wall names it « finish », because the insulation is on the
    // outside and it is what one sees.
    const insulation = exterior.layers.find(
      ({ role }) => role === 'INSULATION',
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
    const rooms = new Map<
      string,
      { readonly levelId: string; readonly outer: readonly Point2D[] }
    >(
      levels.flatMap(({ id: levelId, spaces }) =>
        (spaces ?? []).flatMap((space) =>
          space.boundaryMode === 'MANUAL'
            ? [
                [space.id, { levelId, outer: space.manualPolygon.outer }] as [
                  string,
                  { levelId: string; outer: readonly Point2D[] },
                ],
              ]
            : [],
        ),
      ),
    );
    expect(components.length).toBeGreaterThan(8);
    expect(new Set(components.map(({ levelId }) => levelId)).size).toBe(2);
    // Made of what the user can choose. An equipment written for this file
    // alone answers to no family, carries no version and states no source, and
    // a house built out of such things proves nothing about the catalogue the
    // application actually ships.
    for (const definition of project.equipment ?? []) {
      expect(definition.familyId, definition.id).toBeDefined();
      expect(definition.version, definition.id).toBeDefined();
      expect(definition.provenance, definition.id).toBeDefined();
    }
    for (const opening of project.openingTypes ?? []) {
      expect(opening.familyId, opening.id).toBeDefined();
      expect(opening.provenance, opening.id).toBeDefined();
    }
    // Every placement names a model the project holds.
    const known = new Set((project.equipment ?? []).map(({ id }) => id));
    for (const { id, definitionId } of components)
      expect(definitionId === undefined || known.has(definitionId), id).toBe(
        true,
      );
    // And stands in the room it says it stands in. A basin declaring the
    // upstairs bathroom while sitting two metres outside it is a placement
    // nothing refuses and everything believes: the room's fixture count, its
    // water demand and its drawing all read `spaceId`, and only the drawing
    // would have shown the disagreement.
    for (const component of components) {
      const room = rooms.get(component.spaceId ?? '');
      if (room === undefined) continue;
      expect(room.levelId, component.id).toBe(component.levelId);
      expect(within(component.position, room.outer), component.id).toBe(true);
    }
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

  it('draws no run that leads nowhere and no network in two pieces', async () => {
    // Three invariants nothing checked. A port a system declares and no run
    // joins is a length of pipe somebody meant to draw; a port joined twice is
    // a tee nobody modelled; and a network in two disconnected pieces computes
    // both halves and reports one total. All three are silent: every module
    // still returns a number.
    const loaded = loadProjectJson(await readFile(fixturePath, 'utf8'));
    expect(loaded.status).toBe('OK');
    if (loaded.status !== 'OK') return;
    for (const system of loaded.file.project.systems ?? []) {
      const used = new Map<string, number>();
      for (const edge of system.edges)
        for (const port of [edge.fromPortId, edge.toPortId])
          used.set(port, (used.get(port) ?? 0) + 1);
      expect(
        system.ports.filter(({ id }) => !used.has(id)).map(({ id }) => id),
        `${system.id} : ports qu'aucun tronçon ne joint`,
      ).toEqual([]);
      expect(
        [...used].filter(([, count]) => count > 1).map(([id]) => id),
        `${system.id} : ports joints deux fois`,
      ).toEqual([]);

      // One piece. A node with no port at all is not a defect — a passive wall
      // inlet and a door undercut are drawn and ducted to nothing — but a node
      // that declares a port belongs to the run its ports are on.
      const nodeOfPort = new Map(
        system.ports.map((one) => [one.id, one.nodeId]),
      );
      const near = new Map<string, string[]>();
      for (const edge of system.edges) {
        const from = nodeOfPort.get(edge.fromPortId)!;
        const to = nodeOfPort.get(edge.toPortId)!;
        near.set(from, [...(near.get(from) ?? []), to]);
        near.set(to, [...(near.get(to) ?? []), from]);
      }
      const ducted = system.nodes.filter(({ id }) =>
        system.ports.some((one) => one.nodeId === id),
      );
      const seen = new Set<string>();
      const queue = ducted[0] === undefined ? [] : [ducted[0].id];
      for (const id of queue) seen.add(id);
      while (queue.length > 0) {
        const at = queue.shift()!;
        for (const next of near.get(at) ?? [])
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
      }
      expect(
        ducted.filter(({ id }) => !seen.has(id)).map(({ id }) => id),
        `${system.id} : réseau en deux morceaux`,
      ).toEqual([]);
    }
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
    // Through the bridge, and by the word the catalogue uses: the house is
    // made of fiches now, and a fiche says `PV_MODULE` and `peakPowerWp` where
    // this test used to say `PHOTOVOLTAIC` and `installedPowerWp`.
    const pv = morePv.equipment!.find(
      (entry) => equipmentKindOf(entry) === 'PHOTOVOLTAIC',
    )!;
    (pv.properties as { peakPowerWp: number }).peakPowerWp *= 2;
    const basePv = await output(baseline, 'photovoltaic');
    const changedPv = await output(morePv, 'photovoltaic');
    expect((changedPv.generationWh as number[])[2]).toBeCloseTo(
      (basePv.generationWh as number[])[2]! * 2,
      6,
    );

    const largerBattery = structuredClone(baseline);
    const battery = largerBattery.equipment!.find(
      (entry) => equipmentKindOf(entry) === 'BATTERY',
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

describe('the whole envelope, checked by hand', () => {
  /**
   * A cube whose heat loss anybody can work out on paper.
   *
   * Four walls of ten by three, one window of two by two cut through one of
   * them, a flat roof and a floor, all ten metres square. Every layer is one
   * metre of a material conducting one watt per metre-kelvin, so a bare
   * assembly is exactly 1 m²K/W plus the two surface resistances.
   */
  const SIDE_MM = 10_000;
  const HEIGHT_MM = 3000;
  const U_WINDOW = 1.4;

  function cube(): Project {
    const ground = entityId<'Level'>('ground');
    const square = {
      outer: [
        { x: 0, y: 0 },
        { x: SIDE_MM, y: 0 },
        { x: SIDE_MM, y: SIDE_MM },
        { x: 0, y: SIDE_MM },
      ],
    };
    const wall = (
      id: string,
      from: { x: number; y: number },
      to: typeof from,
    ) =>
      ({
        id: entityId<'Wall'>(id),
        type: 'WALL',
        levelId: ground,
        path: { points: [from, to] },
        referenceSide: 'CENTER',
        assemblyId: 'unit-assembly',
        baseOffsetMm: 0,
        heightMode: 'EXPLICIT',
        heightMm: HEIGHT_MM,
        role: 'EXTERIOR',
      }) as unknown as Project['building']['levels'][number]['walls'][number];
    return {
      id: entityId<'Project'>('cube'),
      metadata: {
        name: 'Cube',
        createdAt: '2026-08-22T00:00:00Z',
        updatedAt: '2026-08-22T00:00:00Z',
      },
      site: { northAngleDeg: 0 },
      materialLibrary: {
        materials: [
          {
            id: 'unit-material',
            name: 'Matériau unité',
            kind: 'GENERIC',
            properties: { lambdaWmK: 1 },
          },
        ],
      },
      assemblies: [
        {
          id: 'unit-assembly',
          name: 'Composition unité',
          category: 'WALL',
          layers: [
            {
              id: 'unit-layer',
              materialId: 'unit-material',
              thicknessM: 1,
              role: 'STRUCTURAL',
            },
          ],
        },
      ],
      equipment: [
        {
          id: 'unit-window',
          kind: 'WINDOW',
          catalogKind: 'GENERIC',
          properties: { uw: U_WINDOW },
        },
      ],
      building: {
        levels: [
          {
            id: ground,
            name: 'RDC',
            elevationMm: 0,
            defaultStoreyHeightMm: HEIGHT_MM,
            walls: [
              wall('w-s', { x: 0, y: 0 }, { x: SIDE_MM, y: 0 }),
              wall('w-e', { x: SIDE_MM, y: 0 }, { x: SIDE_MM, y: SIDE_MM }),
              wall('w-n', { x: SIDE_MM, y: SIDE_MM }, { x: 0, y: SIDE_MM }),
              wall('w-w', { x: 0, y: SIDE_MM }, { x: 0, y: 0 }),
            ],
            openings: [
              {
                id: entityId<'Opening'>('glazing'),
                type: 'OPENING',
                openingType: 'WINDOW',
                host: { kind: 'WALL', id: entityId<'Wall'>('w-s') },
                offsetAlongHostMm: 1000,
                sillHeightMm: 500,
                widthMm: 2000,
                heightMm: 2000,
                definitionId: 'unit-window',
              },
            ],
            slabs: [
              {
                id: entityId<'Slab'>('floor'),
                type: 'SLAB',
                levelId: ground,
                polygon: square,
                assemblyId: 'unit-assembly',
                elevationOffsetMm: 0,
                role: 'FLOOR',
              },
            ],
            roofs: [
              {
                id: entityId<'RoofPlane'>('roof'),
                type: 'ROOF_PLANE',
                levelId: ground,
                footprint: square,
                assemblyId: 'unit-assembly',
                slopeDeg: 0,
                azimuthDeg: 180,
                baseElevationMm: HEIGHT_MM,
              },
            ],
            spaces: [],
            stairs: [],
            annotations: [],
          },
        ],
        zones: [],
      },
      calculationSettings: {
        thermal: {
          moduleId: 'thermal',
          moduleVersion: '2.0.0',
          methodId: 'assembly-u-value-v1',
          precisionTarget: 'ENGINEERING',
          settings: {},
        },
      },
    } as unknown as Project;
  }

  it('adds the window, the roof and the floor to the walls', async () => {
    const context = createProjectCalculationContext(cube(), {});
    const built = buildProjectCalculationInputs(context);
    const result = await orchestrator().calculateModule(
      'thermal',
      built.inputs,
      {},
    );
    expect(result.status, JSON.stringify(result)).toBe('OK');
    if (result.status !== 'OK') return;

    // Each element takes the films its own direction of flow and its own far
    // side call for: heat does not leave a house the same way through the
    // floor as through the walls.
    const input = built.inputs.thermal as Readonly<Record<string, number>>;
    const wallU =
      1 /
      ((input.insideSurfaceResistanceM2KW ?? 0) +
        1 +
        (input.outsideSurfaceResistanceM2KW ?? 0));
    // Upward through the roof: Rsi 0,10, Rse 0,04.
    const roofU = 1 / (0.1 + 1 + 0.04);
    // Downward onto the ground: Rsi 0,17, and no external film — earth is not
    // a breeze.
    const floorU = 1 / (0.17 + 1);
    // 4 × 10 × 3 = 120 m² of wall, less 4 m² of window.
    const expected =
      wallU * (120 - 4) + U_WINDOW * 4 + roofU * 100 + floorU * 100;
    expect(
      result.result.outputs.heatTransferCoefficientWK as number,
    ).toBeCloseTo(expected, 6);
  });

  it('used to lose the window, the roof and the floor entirely', async () => {
    // The same house, counted the way the envelope used to be: opaque walls
    // net of their openings and nothing else. The difference is what was
    // silently missing from every heating load this application computed.
    const context = createProjectCalculationContext(cube(), {});
    const built = buildProjectCalculationInputs(context);
    const input = built.inputs.thermal as Readonly<Record<string, number>>;
    const opaqueU =
      1 /
      ((input.insideSurfaceResistanceM2KW ?? 0) +
        1 +
        (input.outsideSurfaceResistanceM2KW ?? 0));
    const result = await orchestrator().calculateModule(
      'thermal',
      built.inputs,
      {},
    );
    if (result.status !== 'OK') return;
    const now = result.result.outputs.heatTransferCoefficientWK as number;
    expect(now).toBeGreaterThan(opaqueU * 116 * 2);
  });
});

describe('the weather a project is computed with', () => {
  it('refuses a climate the project asked for and nobody supplied', async () => {
    // Falling back to whichever dataset happened to be loaded computed a
    // house with a climate nobody chose, and said nothing.
    const loaded = loadProjectJson(await readFile(fixturePath, 'utf8'));
    if (loaded.status !== 'OK') throw new Error(loaded.status);
    const elsewhere: Project = {
      ...loaded.file.project,
      site: { ...loaded.file.project.site, climateProfileId: 'bordeaux' },
    };
    const context = createProjectCalculationContext(elsewhere, {
      climate: await climateDatasets(),
    });
    expect(context.climate).toBeUndefined();
    expect(context.subDailyClimate).toBeUndefined();
    const built = buildProjectCalculationInputs(context);
    const said = built.missing.filter(({ key }) => key === 'climateProfileId');
    // Every module whose answer depends on the weather says which dataset it
    // wanted, rather than one of them quietly using Rennes.
    expect(said.map(({ moduleId }) => moduleId).sort()).toEqual([
      'energy-balance',
      'heating',
      'hygrothermal',
      'iaq',
      'photovoltaic',
      'rainwater',
    ]);
    expect(said[0]?.message).toContain('bordeaux');
  });

  it('pairs the design day and the year of the same place', async () => {
    const loaded = loadProjectJson(await readFile(fixturePath, 'utf8'));
    if (loaded.status !== 'OK') throw new Error(loaded.status);
    const context = createProjectCalculationContext(loaded.file.project, {
      climate: await climateDatasets(),
    });
    expect(context.climate?.datasetId).toBe('reference-temperate');
    expect(context.subDailyClimate?.datasetId).toBe(
      'reference-temperate-design-day',
    );
  });
});
