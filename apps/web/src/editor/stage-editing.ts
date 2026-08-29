/**
 * Ce que l'espace actif laisse faire, avant qu'on le propose.
 *
 * `ProjectEditingSession.dispatch` refuse déjà toute commande qui touche un
 * objet d'un autre espace, et c'est le bon endroit pour tenir la règle : il
 * n'existe qu'un passage qui écrit. Mais un verrou n'est pas une interface.
 * L'inspecteur affichait ses quinze champs et son bouton « Supprimer » sur une
 * parcelle regardée depuis Bâtiment, le menu contextuel offrait « Pivoter » et
 * « Retourner » sur un mur regardé depuis Systèmes : on tapait une valeur, on
 * la validait, et la seule réponse était une phrase en bas de l'écran. Un
 * bouton qui mène à un refus coûte plus qu'un bouton absent — il fait douter
 * du dessin plutôt que de l'endroit d'où on le regarde.
 *
 * Ce module est donc la même règle, lue à l'endroit : il ne décide de rien —
 * `ownership.ts` décide — il traduit sa réponse en « voici ce qu'on peut
 * proposer ici », pour que ce qui est affiché soit exactement ce qui aboutit.
 *
 * Il vit dans `editor/` et non dans `ux/` pour la raison qui interdit
 * l'inverse : `ownership.ts` lit `inspectObject` pour connaître la famille
 * d'un objet. Faire répondre `object-editors.ts` sur les droits refermerait le
 * cercle entre les deux modules. Ce qui compose les deux se range donc à côté
 * de ceux qui s'en servent — l'inspecteur et le menu.
 */
import type { Project } from '@house-technical-designer/core-domain';

import {
  CREATION_STAGES,
  creationStage,
  type CreationStageId,
} from '../ux/creation-stages.js';
import { canEdit, ownerStageOf, unownedIn } from '../ux/ownership.js';
import type { InspectorEdit } from './inspector-edits.js';
import {
  objectActionsFor,
  type ObjectAction,
  type ObjectActionContext,
} from './object-actions.js';
import {
  contextActionsFor,
  editsFor,
  sharedEditsFor,
  type ObjectContextAction,
  type SharedEdit,
} from './object-editors.js';

/**
 * Pourquoi la sélection ne se modifie pas ici, et où elle se modifie.
 *
 * Nommer l'espace propriétaire est la moitié de la réponse ; y mener est
 * l'autre. « Cet objet n'est pas modifiable » laisse chercher dans sept
 * onglets celui qui le rendra modifiable, ce qui est le trajet même que la
 * règle des espaces existe pour supprimer.
 */
export interface ReadOnlyNotice {
  /**
   * Les espaces qui possèdent les objets bloqués, sans doublon.
   *
   * Une sélection prise à la bande traverse les familles : trois murs et un
   * radiateur regardés depuis Aménagement sont bloqués par deux espaces
   * différents, et taire l'un des deux ferait promettre à un bouton une
   * édition qui resterait refusée.
   */
  readonly owners: readonly CreationStageId[];
  /** La phrase telle qu'elle se lit dans le panneau. */
  readonly sentence: string;
  /**
   * Le bouton, seulement quand un seul espace est en cause.
   *
   * Deux propriétaires ne font pas deux boutons : on ne choisit pas entre deux
   * endroits où aller à moitié. La phrase les nomme, et on réduit sa sélection
   * soi-même.
   */
  readonly action?: {
    readonly stage: CreationStageId;
    readonly label: string;
  };
}

/** Les espaces propriétaires des objets qu'ici on ne peut pas modifier. */
function blockingOwners(
  stage: CreationStageId,
  project: Project,
  selection: readonly string[],
): readonly CreationStageId[] {
  const owners = new Set<CreationStageId>();
  for (const objectId of unownedIn(stage, project, selection)) {
    const owner = ownerStageOf(project, objectId);
    // `unownedIn` ne rend que des objets qui ont un propriétaire, et ce
    // propriétaire n'est pas l'espace actif ; la garde est là pour que le type
    // le dise aussi.
    if (owner !== undefined) owners.add(owner);
  }
  // Dans l'ordre des espaces plutôt que dans celui de la sélection : la phrase
  // se lit deux fois de suite sur deux sélections voisines, et deux ordres
  // différents pour les deux mêmes espaces se lisent comme deux réponses.
  return CREATION_STAGES.filter((candidate) => owners.has(candidate));
}

/**
 * Ce qu'il y a à dire quand la sélection ne se modifie pas ici — rien à dire
 * quand elle s'y modifie.
 *
 * `undefined` est donc « allez-y », et c'est la réponse d'un objet sans
 * propriétaire comme celle d'un objet qu'on regarde depuis chez lui.
 */
export function readOnlyNoticeFor(
  stage: CreationStageId,
  project: Project,
  selection: readonly string[],
): ReadOnlyNotice | undefined {
  const owners = blockingOwners(stage, project, selection);
  const first = owners[0];
  if (first === undefined) return undefined;
  const many = selection.length > 1;
  const subject = many ? 'Ces objets se modifient' : 'Cet objet se modifie';
  if (owners.length > 1)
    return {
      owners,
      sentence: `${subject} ailleurs : ${owners
        .map((owner) => creationStage(owner).label)
        .join(', ')}.`,
    };
  const label = creationStage(first).label;
  return {
    owners,
    sentence: `${subject} dans ${label}.`,
    action: { stage: first, label: `Modifier dans ${label}` },
  };
}

/**
 * Les champs modifiables d'un objet, depuis cet espace.
 *
 * Aucun ailleurs : un champ grisé raconterait qu'il manque une valeur, alors
 * que la valeur est là et que c'est l'endroit qui n'est pas le bon. Les faits
 * de l'objet restent lus par `inspectObject`, qui n'est pas filtré — on vient
 * souvent lire un mur depuis Systèmes, c'est même pour cela qu'il y est
 * visible.
 */
export function editsInStage(
  stage: CreationStageId,
  project: Project,
  objectId: string,
): readonly InspectorEdit[] {
  return canEdit(stage, project, objectId) ? editsFor(project, objectId) : [];
}

/**
 * Les champs qu'une sélection multiple modifie d'un coup, depuis cet espace.
 *
 * Un seul objet d'un autre espace suffit à tout retirer, parce qu'une édition
 * commune est une édition : l'appliquer aux six objets qu'on possède et pas au
 * septième donnerait une maison à moitié changée sans que rien ne l'ait dit.
 */
export function sharedEditsInStage(
  stage: CreationStageId,
  project: Project,
  selection: readonly string[],
): readonly SharedEdit[] {
  return unownedIn(stage, project, selection).length === 0
    ? sharedEditsFor(project, selection)
    : [];
}

/**
 * Si cet espace peut supprimer cette sélection.
 *
 * Même règle, et pour la même raison : une suppression partielle est le pire
 * des refus, puisqu'elle a déjà eu lieu quand on s'en aperçoit.
 */
export function canDeleteInStage(
  stage: CreationStageId,
  project: Project,
  selection: readonly string[],
): boolean {
  return (
    selection.length > 0 && unownedIn(stage, project, selection).length === 0
  );
}

/**
 * Ce que la famille d'un objet offre, quand cet espace le possède.
 *
 * Retourner un mur, inverser sa référence, casser un tronçon : ce sont toutes
 * des commandes, et une commande venue du mauvais espace est refusée. Le menu
 * garde donc ce qui lit — cadrer, désigner les semblables, suivre les liens —
 * et perd ce qui écrit.
 */
export function contextActionsInStage(
  stage: CreationStageId,
  project: Project,
  levelId: string,
  objectId: string,
): readonly ObjectContextAction[] {
  return canEdit(stage, project, objectId)
    ? contextActionsFor(project, levelId, objectId)
    : [];
}

/**
 * Ce que la sélection offre, depuis cet espace.
 *
 * `object-actions.ts` décrit une action une fois pour tous les affichages —
 * barre contextuelle, menu, palette — et il ne connaît pas les espaces. C'est
 * ici, et nulle part ailleurs, que la frontière d'édition s'applique à ce
 * registre : une action qui **écrit** disparaît dès qu'un seul objet de la
 * sélection appartient à un autre espace ; une action qui **lit** — cadrer,
 * désigner les semblables — reste, parce qu'on vient précisément lire un mur
 * depuis Systèmes.
 *
 * Un seul objet venu d'ailleurs suffit à tout retirer, comme pour l'édition
 * commune et la suppression : appliquer un geste à six objets sur sept
 * laisserait une maison à moitié changée sans que rien ne l'ait dit.
 *
 * Que la règle tienne au champ `writes` plutôt qu'à une liste d'actions
 * autorisées est délibéré : une liste se met à jour, et celle qu'on oublie de
 * mettre à jour est celle de l'action qu'on vient d'ajouter.
 */
export function objectActionsInStage(
  stage: CreationStageId,
  context: ObjectActionContext,
): readonly ObjectAction[] {
  const blocked =
    unownedIn(stage, context.project, context.selection).length > 0;
  return objectActionsFor(context).filter(
    (action) => !(action.writes && blocked),
  );
}
