/**
 * Ce que les commandes d'édition écrivent vraiment dans le projet.
 *
 * Les outils sont éprouvés par `tool-registry.test.ts`, qui part de leurs
 * options et va jusqu'à la commande. Reste la couche du dessous : ce que la
 * commande écrit dans le modèle une fois qu'on lui a dit quoi poser. C'est là
 * que se joue le défaut le plus coûteux d'une maquette — un champ que
 * personne ne remplit et que tout le monde croit rempli.
 */
import { describe, expect, it } from 'vitest';

import { ProjectCommandDispatcher } from '@house-technical-designer/editor-core';
import type { ProjectFile } from '@house-technical-designer/core-domain';
import { isWallOpening } from '@house-technical-designer/core-domain';

import { loadDemoProject } from '../demo-project.js';
import {
  addOpeningCommand,
  type OpeningToolDraft,
} from './editing-commands.js';

function file(): ProjectFile {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file;
}

/**
 * Un point posé sur les murs de la maison de démonstration.
 *
 * (5 000, 0) est sur le mur sud, qui va de (0, 0) à (10 000, 0), et à
 * l'aplomb de la cloison qui remonte de là : la commande héberge l'ouverture
 * dans le plus proche des deux, et lequel c'est ne regarde pas ce test. Ce
 * qu'il faut est un point qui trouve un mur — un point choisi au hasard n'en
 * trouverait aucun et la commande refuserait, ce qui ne prouverait rien.
 */
const ON_A_WALL = { x: 5000, y: 0 };

/** L'ouverture que la commande vient de poser, retrouvée par son identifiant. */
function posed(project: ProjectFile['project'], openingId: string) {
  return project.building.levels
    .flatMap((level) => level.openings)
    .find(({ id }) => id === openingId);
}

function pose(opened: ProjectFile, draft: OpeningToolDraft, openingId: string) {
  const result = addOpeningCommand(
    opened,
    'ground',
    ON_A_WALL,
    draft,
    openingId,
  );
  expect(result.status).toBe('OK');
  if (result.status !== 'OK') throw new Error('la pose a été refusée');
  const dispatcher = new ProjectCommandDispatcher(opened.project);
  expect(dispatcher.dispatch(result.command).status).toBe('APPLIED');
  return posed(dispatcher.project, openingId);
}

/** Les trois nombres qu'une fenêtre ordinaire porte, pour ne pas les répéter. */
const WINDOW: OpeningToolDraft = {
  openingType: 'WINDOW',
  widthMm: 1200,
  heightMm: 1350,
  sillHeightMm: 900,
};

describe('la menuiserie d’une ouverture posée', () => {
  it('écrit le modèle que l’outil a désigné', () => {
    /*
     * `Opening.definitionId` est ce qui porte la transmission thermique de la
     * baie. La commande ne l'écrivait pas — elle ne pouvait même pas le
     * recevoir — donc toute fenêtre dessinée arrivait dans le bilan
     * énergétique comme une inconnue.
     */
    const opened = file();
    const opening = pose(
      opened,
      { ...WINDOW, definitionId: 'generic-window-casement-double' },
      'opening-pose-1',
    );
    expect(opening?.definitionId).toBe('generic-window-casement-double');
  });

  it('n’écrit rien plutôt qu’un champ vide quand aucun modèle n’est désigné', () => {
    /*
     * Le champ absent et le champ vide ne disent pas la même chose : le
     * premier dit « pas encore renseigné », le second désignerait une
     * menuiserie dont l'identifiant est la chaîne vide, que le catalogue ne
     * tient évidemment pas. `exactOptionalPropertyTypes` refuse le second à la
     * compilation ; ce test refuse aussi celui qu'on écrirait par erreur.
     */
    const opened = file();
    for (const [rank, definitionId] of [undefined, ''].entries()) {
      const opening = pose(
        opened,
        {
          ...WINDOW,
          ...(definitionId === undefined ? {} : { definitionId }),
        },
        `opening-pose-vide-${rank}`,
      );
      expect(opening).toBeDefined();
      expect(opening?.definitionId).toBeUndefined();
    }
  });

  it('laisse le reste de la baie exactement comme avant', () => {
    // La menuiserie s'ajoute, elle ne déplace rien : largeur, hauteur et
    // allège restent ce que l'outil a dit, et l'ouverture reste dans son mur.
    const opened = file();
    const opening = pose(
      opened,
      { ...WINDOW, definitionId: 'generic-window-casement-double' },
      'opening-pose-2',
    );
    expect(opening?.widthMm).toBe(1200);
    expect(opening?.heightMm).toBe(1350);
    // L'allège n'existe que sur une ouverture de mur : une lucarne n'en a
    // pas. Le garde du domaine le dit au compilateur, et prouve du même coup
    // que ce qu'on vient de poser perce bien un mur.
    expect(opening !== undefined && isWallOpening(opening)).toBe(true);
    if (opening === undefined || !isWallOpening(opening)) return;
    expect(opening.sillHeightMm).toBe(900);
  });
});
