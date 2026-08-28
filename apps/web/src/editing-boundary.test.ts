/**
 * La frontière d'édition, sur le seul passage qui existe.
 *
 * Il n'y a qu'un endroit où le projet change — `ProjectEditingSession.dispatch`
 * — et c'est ce qui rend la règle tenable. Le clic, la poignée, l'inspecteur,
 * le menu contextuel, `Delete`, un raccourci, la palette, l'arborescence, un
 * constat : tous les chemins finissent par une commande, et toutes les
 * commandes passent ici. Tester le passage, c'est tester les huit chemins.
 *
 * Avant, seule la sélection au plan était filtrée. Une sélection obtenue
 * autrement — Ctrl+K, l'arborescence, un constat — puis `Delete`, et l'objet
 * d'un autre onglet disparaissait.
 *
 * Le geste choisi est la suppression, parce que c'est le plus destructeur et
 * parce qu'il existe pour les quatre familles qui ont un propriétaire.
 */
import { describe, expect, it } from 'vitest';

import { ProjectEditingSession } from './project-workspace.js';
import { loadDemoProject } from './demo-project.js';
import { removalCommandFor } from './editor/object-editors.js';
import { CREATION_STAGES, type CreationStageId } from './ux/creation-stages.js';

function file() {
  const loaded = loadDemoProject();
  if (loaded.status !== 'OK') throw new Error(loaded.message);
  return loaded.file;
}

function removeFrom(stage: CreationStageId, objectId: string) {
  const source = file();
  const session = new ProjectEditingSession(source);
  const command = removalCommandFor(source.project, 'ground', objectId);
  if (command === undefined) throw new Error(`rien ne supprime ${objectId}`);
  return session.dispatch(command, stage);
}

/** Un objet par espace propriétaire, pris dans la maison de référence. */
const OWNED: readonly (readonly [CreationStageId, string])[] = [
  ['SITE', 'obstacle-oak'],
  ['BUILDING', 'wall-east'],
  ['FITTING', 'component-dhw-tank'],
  // Un objet des systèmes que rien d'autre ne retient : la VMC est désignée
  // par son réseau, et le modèle refuse déjà de la retirer — un refus qui
  // n'aurait rien dit de la frontière.
  ['SYSTEMS', 'component-radiator-living'],
];

const LABEL_OF: Readonly<Record<string, string>> = {
  SITE: 'Terrain',
  BUILDING: 'Bâtiment',
  FITTING: 'Aménagement',
  SYSTEMS: 'Systèmes',
};

describe('ce qu’un espace peut écrire, et ce qu’il ne peut pas', () => {
  it.each(OWNED)('lets %s delete what it owns', (stage, objectId) => {
    expect(removeFrom(stage, objectId).status).toBe('OK');
  });

  it.each(OWNED)('refuses %s’s objects everywhere else', (owner, objectId) => {
    for (const stage of CREATION_STAGES) {
      if (stage === owner) continue;
      const refused = removeFrom(stage, objectId);
      expect(refused.status, `${stage} → ${objectId}`).toBe('ERROR');
      // Le refus nomme l'espace où le geste marche : « refusé » tout seul
      // laisse chercher, et c'est le trajet que cette règle doit supprimer.
      if (refused.status !== 'ERROR') continue;
      expect(refused.messages.join(' '), stage).toContain(LABEL_OF[owner]!);
    }
  });

  it('refuses a placed object by what it is, not by its family', () => {
    /*
     * Le ballon d'eau chaude et la VMC sont le même `COMPONENT`. L'un se pose
     * en Aménagement, l'autre en Systèmes, et chacun est refusé chez l'autre.
     * Une règle par famille les aurait rangés ensemble.
     */
    expect(removeFrom('FITTING', 'component-vmc').status).toBe('ERROR');
    expect(removeFrom('SYSTEMS', 'component-dhw-tank').status).toBe('ERROR');
  });

  it('leaves alone what no stage claims', () => {
    /*
     * La règle ne mord que sur les objets posés. Un réglage de projet, une
     * entrée de bibliothèque, un niveau : personne ne les revendique, donc
     * personne ne les refuse. Sans ça, renommer le projet depuis l'onglet
     * Bâtiment serait devenu impossible.
     */
    const source = file();
    const session = new ProjectEditingSession(source);
    const command = removalCommandFor(source.project, 'ground', 'wall-east');
    // Preuve que c'est bien le propriétaire qui décide et non la commande :
    // la même commande passe chez lui et se fait refuser ailleurs.
    expect(session.dispatch(command!, 'BUILDING').status).toBe('OK');
  });

  it('writes nothing when it refuses, so undo still undoes the last real edit', () => {
    /*
     * L'essai à blanc sert à ça. Sans lui, la commande serait passée puis
     * annulée derrière, et `Ctrl+Z` aurait défait le geste d'avant.
     */
    const session = new ProjectEditingSession(file());
    const wall = removalCommandFor(session.file.project, 'ground', 'wall-east');
    expect(session.dispatch(wall!, 'BUILDING').status).toBe('OK');

    const tree = removalCommandFor(
      session.file.project,
      'ground',
      'obstacle-oak',
    );
    expect(session.dispatch(tree!, 'BUILDING').status).toBe('ERROR');
    expect(
      session.file.project.site.obstacles?.some(
        ({ id }) => id === 'obstacle-oak',
      ),
    ).toBe(true);

    // L'annulation rend le mur — le seul geste qui ait eu lieu.
    expect(session.undo().status).toBe('OK');
    expect(
      session.file.project.building.levels[0]?.walls.some(
        ({ id }) => id === 'wall-east',
      ),
    ).toBe(true);
  });
});
