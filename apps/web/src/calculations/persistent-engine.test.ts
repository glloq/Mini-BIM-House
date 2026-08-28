/**
 * Ce qu'une deuxième exécution coûte à l'application.
 *
 * `runProjectCalculations` créait un orchestrateur neuf à chaque appel. Le
 * cache existait, il était exact, et il était jeté à la fin de chaque
 * exécution : dix-sept modules recalculaient tout à chaque révision du projet,
 * y compris ceux que la modification ne touchait pas.
 *
 * Ces tests passent par la fonction que l'application appelle, et non par
 * l'orchestrateur : ce qui compte n'est pas qu'un cache soit possible, mais
 * qu'il serve là où l'application le demande. Ils lisent `recomputed`, que la
 * course rapporte, parce qu'un gain qu'on ne peut pas lire est un gain qu'on
 * perdra au prochain remaniement.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import { loadDemoProject, demoClimateDatasets } from '../demo-project.js';
import {
  calculationCacheStatistics,
  resetCalculationEngine,
  runProjectCalculations,
} from './calculation-runner.js';

function house(): Project {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file.project;
}

/*
 * Chaque test part d'un cache vide, sinon c'est l'ordre des tests qui décide
 * de leurs résultats — exactement le défaut qu'un cache partagé introduit si
 * on ne le dit pas.
 */
beforeEach(async () => {
  await resetCalculationEngine();
});

describe('l’orchestrateur que l’application garde', () => {
  it('ne recalcule rien quand on redemande le même projet', async () => {
    const project = house();
    const climate = demoClimateDatasets();
    const first = await runProjectCalculations(project, climate);
    expect(first.recomputed).toHaveLength(first.runs.length);

    const second = await runProjectCalculations(project, climate);
    // Aucun module ne tourne, et les résultats sont ceux de la première course.
    expect(second.recomputed).toEqual([]);
    expect(second.runs.every(({ reused }) => reused)).toBe(true);
    expect(second.runs.map(({ result }) => result?.inputFingerprint)).toEqual(
      first.runs.map(({ result }) => result?.inputFingerprint),
    );
  });

  it('ne recalcule qu’une partie quand une seule chose change', async () => {
    const climate = demoClimateDatasets();
    const project = house();
    const before = await runProjectCalculations(project, climate);

    const level = project.building.levels[0]!;
    const wall = level.walls[0]!;
    const points = [...wall.path.points];
    points[1] = { ...points[1]!, x: points[1]!.x + 250 };
    const moved: Project = {
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

    const after = await runProjectCalculations(moved, climate);
    // Quelque chose bouge, mais pas tout : c'est la propriété entière.
    expect(after.recomputed.length).toBeGreaterThan(0);
    expect(after.recomputed.length).toBeLessThan(before.runs.length);
    expect(after.recomputed).toContain('thermal');
  });

  it('compte ce qu’il a évité', async () => {
    const project = house();
    const climate = demoClimateDatasets();
    await runProjectCalculations(project, climate);
    const before = await calculationCacheStatistics();
    await runProjectCalculations(project, climate);
    const after = await calculationCacheStatistics();
    // Rien n'a été calculé de plus, et tout a été retrouvé.
    expect(after.misses).toBe(before.misses);
    expect(after.hits).toBeGreaterThan(before.hits);
  });
});
