import { describe, expect, it } from 'vitest';
import { ProjectCommandDispatcher } from '@house-technical-designer/editor-core';

import { loadDemoProject } from '../demo-project.js';
import { ProjectEditingSession } from '../project-workspace.js';
import { ownerStageOf } from '../ux/ownership.js';
import {
  storeyCommands,
  storeyCount,
  storeyName,
  storeyRemovalBlock,
} from './storeys.js';

const demo = loadDemoProject();
if (demo.status === 'ERROR') throw new Error(demo.message);
const file = demo.file;
const project = file.project;

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

  it('ajoute un étage depuis Bâtiment sur une maison entièrement équipée', () => {
    /*
     * C'est le geste tel qu'il est fait : le « + » vit dans l'espace Bâtiment
     * et passe par la session, qui tient la frontière d'édition. Avant, la
     * copie emportait les vingt-trois appareils du rez-de-chaussée de la
     * maison de démonstration — dix-neuf de Systèmes, quatre d'Aménagement —
     * et la commande était refusée en bloc : zéro étage sur deux se
     * dupliquait, et le message parlait de Systèmes à quelqu'un qui voulait
     * un étage de plus.
     */
    const session = new ProjectEditingSession(file);
    const commands = storeyCommands(
      project,
      storeyCount(project) + 1,
      (prefix) => `${prefix}-ajout`,
    );
    expect(commands).toHaveLength(1);
    const result = session.dispatch(commands[0]!, 'BUILDING');
    expect(
      result.status === 'ERROR' ? result.messages.join(' ') : 'appliqué',
    ).toBe('appliqué');
    expect(session.file.project.building.levels).toHaveLength(3);
  });

  it('ne fait monter que ce que le bâtiment possède', () => {
    /*
     * La règle est celle qui refuse le geste, pas une liste écrite à côté :
     * un mur monte, un radiateur non. La démonstration porte vingt-trois
     * appareils au rez-de-chaussée, dont aucun n'appartient au bâtiment.
     */
    const base = [...project.building.levels].sort(
      (first, second) => first.elevationMm - second.elevationMm,
    )[0]!;
    expect(base.components?.length ?? 0).toBeGreaterThan(0);
    const before = new Set(project.building.levels.map(({ id }) => id));
    const grown = after(storeyCount(project) + 1);
    const added = grown.building.levels.filter(({ id }) => !before.has(id));
    expect(added).toHaveLength(1);
    const copy = added[0]!;
    // Le bâti suit…
    expect(copy.walls.length).toBe(base.walls.length);
    expect(copy.slabs.length).toBe(base.slabs.length);
    expect(copy.spaces.length).toBe(base.spaces.length);
    // …et rien de ce qui appartient à un autre espace.
    const foreign = (copy.components ?? []).filter((component) => {
      const owner = ownerStageOf(grown, component.id);
      return owner !== undefined && owner !== 'BUILDING';
    });
    expect(foreign.map(({ id }) => id)).toEqual([]);
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
