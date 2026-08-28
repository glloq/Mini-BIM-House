/**
 * Ce que déplacer un mur doit coûter.
 *
 * Dix-sept modules, et une maison qu'on dessine en déplaçant des murs un par
 * un. Recalculer les dix-sept à chaque geste, c'est refaire le bilan carbone
 * parce qu'une prise a bougé de trois centimètres — et c'est ce qui se passait,
 * non pas faute de cache, mais parce que l'application en créait un neuf à
 * chaque exécution.
 *
 * L'invalidation sélective de cet orchestrateur ne se déclare pas : les
 * résultats sont adressés par l'empreinte de ce qui les produit. Un module dont
 * les entrées n'ont pas bougé retrouve la sienne, et rien ne tourne. Ces tests
 * comptent, parce qu'une propriété de performance qu'on n'énumère pas est une
 * propriété qu'on perd sans s'en apercevoir : le jour où un module lira
 * l'heure, ou un identifiant tiré au sort, le compte tombe et le dit.
 */
import { describe, expect, it } from 'vitest';
import { CalculationOrchestrator } from '@house-technical-designer/calculation-core';
import type { Project } from '@house-technical-designer/core-domain';
import { PROJECT_CALCULATION_MODULES } from './modules.js';
import { PROJECT_CALCULATION_MODULE_IDS } from './module-registry.js';
import {
  createPreReferenceClimate,
  createPreReferenceProject,
} from './pre-reference-fixture.js';
import { createProjectCalculationContext } from './project-context.js';
import { buildProjectCalculationInputs } from './project-inputs.js';

function build(source: Project, climate = createPreReferenceClimate()) {
  return buildProjectCalculationInputs(
    createProjectCalculationContext(source, { climate }),
  );
}

function engine(capacity?: number): CalculationOrchestrator {
  const orchestrator =
    capacity === undefined
      ? new CalculationOrchestrator()
      : new CalculationOrchestrator(capacity);
  PROJECT_CALCULATION_MODULES.forEach((module) =>
    orchestrator.register(module),
  );
  return orchestrator;
}

/** Passe les dix-sept modules et rend ceux qui ont réellement tourné. */
async function runAll(
  orchestrator: CalculationOrchestrator,
  inputs: ReturnType<typeof build>['inputs'],
): Promise<readonly string[]> {
  const recomputed: string[] = [];
  for (const moduleId of PROJECT_CALCULATION_MODULE_IDS) {
    const outcome = await orchestrator.calculateModule(moduleId, inputs, {});
    if (outcome.status !== 'OK' || !outcome.cacheHit) recomputed.push(moduleId);
  }
  return recomputed;
}

const house = (): Project =>
  structuredClone(createPreReferenceProject().project);

/** Le même projet, avec un mur dont l'extrémité a bougé. */
function withMovedWall(project: Project, byMm: number): Project {
  const level = project.building.levels[0]!;
  const wall = level.walls[0]!;
  const points = [...wall.path.points];
  points[1] = { ...points[1]!, x: points[1]!.x + byMm };
  return {
    ...project,
    building: {
      ...project.building,
      levels: [
        {
          ...level,
          walls: [
            { ...wall, path: { ...wall.path, points } },
            ...level.walls.slice(1),
          ],
        },
        ...project.building.levels.slice(1),
      ],
    },
  };
}

describe('ce qu’une modification recalcule', () => {
  it('ne recalcule rien du tout quand rien ne bouge', async () => {
    const orchestrator = engine();
    const { inputs } = build(house());
    const first = await runAll(orchestrator, inputs);
    expect(first).toHaveLength(PROJECT_CALCULATION_MODULE_IDS.length);
    // Le même projet, les mêmes entrées : la deuxième passe ne calcule rien.
    // C'est le cas que l'application rencontrait le plus — ouvrir l'onglet des
    // calculs, aller aux vérifications, revenir — et qu'elle payait plein tarif.
    expect(await runAll(orchestrator, inputs)).toEqual([]);
  });

  it('ne recalcule que le thermique et ce qui en découle quand un mur bouge', async () => {
    const orchestrator = engine();
    await runAll(orchestrator, build(house()).inputs);

    // Cent trente-sept millimètres : un geste de dessin ordinaire.
    const moved = withMovedWall(house(), 137);

    const recomputed = await runAll(orchestrator, build(moved).inputs);
    /*
     * L'enveloppe change, donc le thermique ; le chauffage lit le thermique,
     * et le bilan d'énergie lit le chauffage. Le coût et l'impact carbone
     * lisent les quantités, qui comptent des mètres carrés de mur. Les douze
     * autres — ventilation, eau, assainissement, électricité, éclairage,
     * photovoltaïque, pluie, acoustique, hygrothermie, ECS, stockage,
     * conformité — n'ont aucune raison de tourner, et ne tournent pas.
     */
    expect([...recomputed].sort()).toEqual([
      'cost',
      'energy-balance',
      'environmental',
      'heating',
      'thermal',
    ]);
  });

  it('recalcule ce que le climat touche, et rien de plus', async () => {
    const orchestrator = engine();
    const base = house();
    await runAll(orchestrator, build(base).inputs);

    const warmer = createPreReferenceClimate().map((dataset) => ({
      ...dataset,
      samples: dataset.samples.map((sample) => ({
        ...sample,
        ...(sample.airTemperatureC === undefined
          ? {}
          : { airTemperatureC: sample.airTemperatureC + 3 }),
      })),
    }));
    const recomputed = await runAll(orchestrator, build(base, warmer).inputs);
    /*
     * Trois degrés de plus toute l'année. Le chauffage ne bouge pas, et c'est
     * juste : sa température extérieure de base est un réglage explicite du
     * projet, pas une moyenne du fichier météo — une donnée réglementaire ne
     * se déduit pas d'une année type. Ce qui bouge est ce qui lit réellement
     * les relevés.
     */
    expect(recomputed.length).toBeGreaterThan(0);
    expect(recomputed.length).toBeLessThan(
      PROJECT_CALCULATION_MODULE_IDS.length,
    );
    expect(recomputed).toContain('energy-balance');
  });

  it('retrouve les résultats d’avant quand on annule', async () => {
    // Annuler est un aller-retour, et un cache qui garde plus d'une révision
    // le rend gratuit. C'est la raison d'être de la capacité : sans elle, une
    // entrée par empreinte suffirait, et défaire coûterait autant que faire.
    const orchestrator = engine();
    const base = build(house()).inputs;
    await runAll(orchestrator, base);

    await runAll(orchestrator, build(withMovedWall(house(), 137)).inputs);

    expect(await runAll(orchestrator, base)).toEqual([]);
  });
});

describe('ce que le cache dit de lui-même', () => {
  it('compte ce qu’il a évité', async () => {
    const orchestrator = engine();
    const { inputs } = build(house());
    await runAll(orchestrator, inputs);
    const afterFirst = orchestrator.statistics();
    /*
     * Dix-sept calculs pour dix-sept modules, et pas un de plus : les
     * dépendances se résolvent en cascade — le bilan d'énergie demande le
     * chauffage, qui demande le thermique — et ce que la cascade retrouve
     * déjà calculé compte comme réutilisé dès la première passe. C'est
     * pourquoi il y a des réutilisations avant même qu'on ait redemandé quoi
     * que ce soit.
     */
    expect(afterFirst.misses).toBe(PROJECT_CALCULATION_MODULE_IDS.length);
    expect(afterFirst.hits).toBeGreaterThan(0);

    await runAll(orchestrator, inputs);
    const afterSecond = orchestrator.statistics();
    /*
     * La deuxième passe n'exécute rien : le compte de calculs réels ne bouge
     * pas. Elle retrouve les dix-sept demandés, plus exactement les mêmes
     * dépendances que la première a traversées en cascade — d'où le terme
     * `afterFirst.hits` dans l'égalité, qui n'est pas un ajustement mais la
     * cascade répétée à l'identique.
     */
    expect(afterSecond.misses).toBe(afterFirst.misses);
    expect(afterSecond.hits - afterFirst.hits).toBe(
      PROJECT_CALCULATION_MODULE_IDS.length + afterFirst.hits,
    );
    expect(afterSecond.evictions).toBe(0);
  });

  it('ne grossit pas indéfiniment', async () => {
    // Une capacité de trois, et dix-sept modules : le cache doit rendre la
    // place plutôt que garder tout ce qu'une séance de travail produit.
    const orchestrator = engine(3);
    await runAll(orchestrator, build(house()).inputs);
    const stats = orchestrator.statistics();
    expect(stats.entries).toBe(3);
    expect(stats.evictions).toBeGreaterThan(0);
  });

  it('repart de zéro quand on le vide', async () => {
    const orchestrator = engine();
    const { inputs } = build(house());
    await runAll(orchestrator, inputs);
    orchestrator.clearCache();
    expect(orchestrator.statistics()).toEqual({
      entries: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
    });
    expect(await runAll(orchestrator, inputs)).toHaveLength(
      PROJECT_CALCULATION_MODULE_IDS.length,
    );
  });

  it('refuse une capacité qui n’en est pas une', () => {
    expect(() => new CalculationOrchestrator(0)).toThrow(RangeError);
    expect(() => new CalculationOrchestrator(1.5)).toThrow(RangeError);
  });
});
