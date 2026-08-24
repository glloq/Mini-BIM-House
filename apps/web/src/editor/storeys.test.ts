import { describe, expect, it } from 'vitest';
import { ProjectCommandDispatcher } from '@house-technical-designer/editor-core';

import { loadDemoProject } from '../demo-project.js';
import {
  storeyCommands,
  storeyCount,
  storeyName,
  storeyRemovalBlock,
} from './storeys.js';

const demo = loadDemoProject();
if (demo.status === 'ERROR') throw new Error(demo.message);
const project = demo.file.project;

let counter = 0;
const newId = (prefix: string): string => `${prefix}-${(counter += 1)}`;

function after(wanted: number) {
  const commands = new ProjectCommandDispatcher(project);
  for (const command of storeyCommands(project, wanted, newId)) {
    const result = commands.dispatch(command);
    if (result.status !== 'APPLIED')
      throw new Error(`refusée : ${JSON.stringify(result)}`);
  }
  return commands.project;
}

describe('combien d’étages la maison a', () => {
  it('nomme les étages comme on les dit', () => {
    // « Étage 1 » plutôt que « Niveau 2 » : le rez-de-chaussée n'est pas un
    // étage, et personne n'appelle le premier étage « niveau 2 ».
    expect(storeyName(0)).toBe('Rez-de-chaussée');
    expect(storeyName(1)).toBe('1er étage');
    expect(storeyName(3)).toBe('3e étage');
  });

  it('ne fait rien quand le compte est déjà le bon', () => {
    expect(storeyCommands(project, storeyCount(project), newId)).toEqual([]);
    expect(storeyCommands(project, 0, newId)).toEqual([]);
    expect(storeyCommands(project, -1, newId)).toEqual([]);
  });

  it('copie la base du bâtiment sur chaque étage ajouté', () => {
    /*
     * C'est la raison d'être du réglage : « je fais une maison à trois
     * niveaux » se dit en dessinant, et ce qu'on veut alors est que les murs
     * porteurs montent — pas les retracer trois fois.
     */
    const base = [...project.building.levels].sort(
      (first, second) => first.elevationMm - second.elevationMm,
    )[0]!;
    const before = new Set(project.building.levels.map(({ id }) => id));
    const grown = after(4);
    expect(grown.building.levels).toHaveLength(4);
    const added = grown.building.levels.filter(({ id }) => !before.has(id));
    expect(added).toHaveLength(2);
    for (const level of added)
      expect(level.walls.length, level.name).toBe(base.walls.length);
    // Et chacun est posé une hauteur d'étage au-dessus du précédent.
    const elevations = [...grown.building.levels]
      .sort((first, second) => first.elevationMm - second.elevationMm)
      .map(({ elevationMm }) => elevationMm);
    for (let index = 1; index < elevations.length; index += 1)
      expect(elevations[index]! - elevations[index - 1]!).toBeGreaterThan(0);
  });

  it('dit avant le clic ce qui empêche de retirer un étage', () => {
    /*
     * Le modèle refuse de supprimer un niveau qui porte encore des objets, et
     * il a raison : effacer vingt-six murs pour avoir tapé « 2 » au lieu de
     * « 3 » est pire que le réglage qu'on cherchait. La raison se lit avant,
     * pas après.
     */
    expect(storeyRemovalBlock(project)).toContain('objet(s)');
    const alone = {
      ...project,
      building: {
        ...project.building,
        levels: [project.building.levels[0]!],
      },
    };
    expect(storeyRemovalBlock(alone)).toContain('au moins un niveau');
  });

  it('retire par le haut un étage qu’on vient d’ajouter', () => {
    // Un étage neuf est vide tant qu'on n'y a rien mis… sauf s'il est la copie
    // de la base : là, le retirer demande de le vider, et le réglage le dit.
    const bare = {
      ...project,
      building: {
        ...project.building,
        levels: [project.building.levels[0]!],
      },
    };
    const commands = new ProjectCommandDispatcher(bare);
    for (const command of storeyCommands(bare, 2, newId))
      expect(commands.dispatch(command).status).toBe('APPLIED');
    expect(commands.project.building.levels).toHaveLength(2);
    expect(storeyRemovalBlock(commands.project)).toContain('objet(s)');
  });
});
