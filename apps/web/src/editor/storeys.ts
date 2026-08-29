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
 *
 * ## Ce qu'un étage neuf emporte, et ce qu'il n'emporte pas
 *
 * `DuplicateLevelCommand` copie **tout** ce que le niveau porte, les appareils
 * posés compris. Or ajouter un étage est un geste du **bâtiment** : il se fait
 * depuis l'espace Bâtiment, sous la rangée des niveaux, et la frontière
 * d'édition refuse à cet espace-là d'écrire dans les objets de Systèmes ou
 * d'Aménagement. Le « + » émettait donc une commande qui touchait trente-sept
 * objets sur la maison de démonstration, dont vingt-trois d'autres espaces —
 * dix-neuf de Systèmes, quatre d'Aménagement — et se faisait refuser en bloc
 * avec « Cet objet appartient à Systèmes ». Zéro niveau sur deux se
 * dupliquait, sans que rien ne le dise d'avance.
 *
 * Deux façons de sortir de là. Prévenir sur le bouton, comme
 * `storeyRemovalBlock` le fait pour le retrait — mais la raison serait « votre
 * maison est meublée », c'est-à-dire toujours, et le réglage n'existerait plus
 * que sur les projets vides, soit exactement ceux où personne n'en a besoin.
 * Ou bien ne copier que ce que le bâtiment possède, et c'est ce qu'on fait :
 * personne n'attend qu'un étage neuf arrive avec une copie de la pompe à
 * chaleur, du ballon, de l'onduleur, de la batterie et du tableau électrique
 * du dessous — des objets dont une maison n'a qu'un exemplaire, et que les
 * métrés compteraient aussitôt en double.
 *
 * La ligne n'est pas écrite ici : c'est `ownerStageOf` qui la trace, la même
 * qui refuse le geste. Ce que le bâtiment ne possède pas ne suit pas la copie,
 * donc plus rien ne se fait refuser — et une famille ajoutée demain à un autre
 * espace sera écartée sans qu'on ait à revenir ici.
 */
import type { Project } from '@house-technical-designer/core-domain';
import {
  DuplicateLevelCommand,
  RemoveLevelCommand,
  type CommandValidation,
  type LevelDraft,
  type ProjectCommand,
  type ProjectCommandExecution,
} from '@house-technical-designer/editor-core';

import { ownerStageOf } from '../ux/ownership.js';

/** L'espace d'où le réglage des niveaux est fait, et le seul. */
const STOREY_STAGE = 'BUILDING';

/**
 * Le projet où l'étage neuf ne garde que ce que le bâtiment possède.
 *
 * Seuls les objets **posés** ont un propriétaire qui varie : un mur, une
 * dalle, une trémie, un escalier sont du bâtiment par nature, une cote et une
 * note ne sont de personne — c'est `ownerStageOf` qui le dit, et c'est à elle
 * qu'on le demande plutôt qu'à une liste écrite ici, qui aurait divergé au
 * premier appareil ajouté au modèle.
 *
 * La question est posée au projet **d'après**, puisque c'est le seul qui porte
 * les copies : un objet qui n'existe pas encore n'a pas de propriétaire.
 */
function builtPartOnly(project: Project, levelId: string): Project {
  const levels = project.building.levels.map((level) => {
    if (level.id !== levelId) return level;
    const kept = (level.components ?? []).filter(({ id }) => {
      const owner = ownerStageOf(project, id);
      return owner === undefined || owner === STOREY_STAGE;
    });
    return { ...level, components: kept };
  });
  return { ...project, building: { ...project.building, levels } };
}

/**
 * Dupliquer un niveau comme le bâtiment le fait : le bâti, et lui seul.
 *
 * Elle délègue tout à `DuplicateLevelCommand` — les murs et leurs baies, les
 * dalles, les toitures, les pièces, les porteurs, l'escalier qui monte vers ce
 * qui se trouve au-dessus de la copie — et se contente de retirer de l'étage
 * neuf ce qui appartient à un autre espace. Ce n'est donc pas une seconde
 * façon de copier un étage : c'est la même, tenue dans les limites du geste
 * qui l'appelle.
 *
 * L'inverse est celui de la commande déléguée, et il est juste tel quel :
 * `BuildingCommand` rend un « rétablir le bâtiment tel qu'il était », qui ne
 * dépend pas de ce que la copie a emporté.
 */
class BuiltStoreyCopyCommand implements ProjectCommand {
  readonly #copy: DuplicateLevelCommand;
  readonly id: string;
  readonly label: string;
  constructor(sourceLevelId: string, draft: LevelDraft) {
    this.#copy = new DuplicateLevelCommand(sourceLevelId, draft);
    // Un identifiant à elle : deux commandes qui portent le même sont deux
    // entrées d'historique qu'on ne distingue plus.
    this.id = `${this.#copy.id}:built`;
    this.label = this.#copy.label;
  }
  validate(project: Project): CommandValidation {
    return this.#copy.validate(project);
  }
  execute(project: Project): ProjectCommandExecution {
    const execution = this.#copy.execute(project);
    return {
      ...execution,
      nextState: builtPartOnly(execution.nextState, this.#copy.draft.id),
    };
  }
}

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
 * qu'on ne veut pas retracer. Le bâti seul : voir l'en-tête du module pour ce
 * qui ne suit pas, et pourquoi.
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
    commands.push(new BuiltStoreyCopyCommand(base.id, draft));
    top = { ...base, ...draft } as typeof top;
  }
  return commands;
}
