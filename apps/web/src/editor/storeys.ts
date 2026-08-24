/**
 * Combien d'étages la maison a, et comment on en ajoute un.
 *
 * Le nombre d'étages se décidait dans l'assistant de création, une fois pour
 * toutes, ou bien s'empilait à la main dans l'éditeur avancé — un niveau, son
 * nom, son altitude, sa hauteur sous plafond, et ensuite retracer les murs.
 * Or « je fais une maison à deux étages » est une phrase qu'on dit **en**
 * dessinant, et ce qu'on veut alors est que le bâti se répète : les mêmes
 * murs porteurs, la même emprise, la même dalle.
 *
 * Ce module ne dessine rien : il dit quelles commandes il faut pour passer de
 * n étages à m. La duplication existe déjà (`DuplicateLevelCommand`) et copie
 * murs, ouvertures, dalles, toitures et pièces — c'est elle qu'on appelle,
 * pas une seconde façon de copier un étage.
 */
import type { Project } from '@house-technical-designer/core-domain';
import {
  DuplicateLevelCommand,
  RemoveLevelCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';

/** Les niveaux du bas vers le haut : c'est l'ordre dans lequel on les nomme. */
function stacked(project: Project) {
  return [...project.building.levels].sort(
    (first, second) => first.elevationMm - second.elevationMm,
  );
}

export function storeyCount(project: Project): number {
  return project.building.levels.length;
}

/**
 * Le nom du n-ième étage, comme on le dit.
 *
 * « Étage 1 » plutôt que « Niveau 2 » : le rez-de-chaussée n'est pas un étage,
 * et personne n'appelle le premier étage « niveau 2 ».
 */
export function storeyName(index: number): string {
  if (index === 0) return 'Rez-de-chaussée';
  return index === 1 ? '1er étage' : `${index}e étage`;
}

/**
 * Ce qui empêche de retirer le niveau du haut, quand quelque chose l'empêche.
 *
 * Le modèle refuse de supprimer un niveau qui porte encore des objets, et il a
 * raison : effacer vingt-six murs pour avoir tapé « 2 » au lieu de « 3 » est
 * pire que le réglage qu'on cherchait. La raison est donc écrite **avant** le
 * clic, sur le bouton, plutôt qu'après, dans un refus.
 */
export function storeyRemovalBlock(project: Project): string | undefined {
  const levels = stacked(project);
  if (levels.length <= 1) return 'Un projet garde au moins un niveau.';
  const top = levels[levels.length - 1]!;
  const held =
    top.walls.length +
    top.slabs.length +
    top.roofs.length +
    top.openings.length +
    top.stairs.length +
    top.spaces.length +
    (top.structure ?? []).length +
    (top.components ?? []).length;
  return held === 0
    ? undefined
    : `« ${top.name} » porte ${held} objet(s) : videz-le avant de le retirer.`;
}

/**
 * Ce qu'il faut faire pour que la maison ait `wanted` niveaux.
 *
 * En ajouter : dupliquer **le niveau du bas** autant de fois qu'il manque
 * d'étages, chacun posé une hauteur d'étage au-dessus du précédent. C'est la
 * base du bâtiment qui se répète — les murs porteurs montent, et ce sont eux
 * qu'on ne veut pas retracer.
 *
 * En retirer : supprimer par le haut. Rien n'est confirmé par une boîte de
 * dialogue : tout se défait, et c'est ce que l'annulation est pour.
 */
export function storeyCommands(
  project: Project,
  wanted: number,
  newId: (prefix: string) => string,
): readonly ProjectCommand[] {
  const levels = stacked(project);
  const base = levels[0];
  if (base === undefined || !Number.isInteger(wanted) || wanted < 1) return [];
  if (wanted === levels.length) return [];

  if (wanted < levels.length)
    return levels
      .slice(wanted)
      .reverse()
      .map((level) => new RemoveLevelCommand(level.id));

  const commands: ProjectCommand[] = [];
  let top = levels[levels.length - 1]!;
  for (let index = levels.length; index < wanted; index += 1) {
    const elevationMm = top.elevationMm + top.defaultStoreyHeightMm;
    const draft = {
      id: newId('level'),
      name: storeyName(index),
      elevationMm,
      defaultStoreyHeightMm: base.defaultStoreyHeightMm,
    };
    commands.push(new DuplicateLevelCommand(base.id, draft));
    top = { ...base, ...draft } as typeof top;
  }
  return commands;
}
