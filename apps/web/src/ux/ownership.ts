/**
 * Qui a le droit de modifier quoi, et depuis quel espace.
 *
 * Trois notions étaient mélangées en une seule. Un objet peut être :
 *
 * - **visible** — il est au dessin, comme contexte ;
 * - **consultable** — on peut le désigner, lire ses propriétés, le localiser ;
 * - **modifiable** — on peut le déplacer, le corriger, le supprimer.
 *
 * Elles ne se recouvrent pas. Un mur doit rester visible dans Systèmes, sinon
 * on route des gaines dans le vide ; il doit y être consultable, sinon un
 * constat thermique n'a nulle part où mener ; il ne doit pas y être
 * modifiable, parce qu'on n'est pas venu là pour déplacer une cloison. Une
 * parcelle, dans Bâtiment, est un cadre : on la voit, on la lit, on n'y touche
 * pas.
 *
 * ## Ce que ce module remplace
 *
 * `selectableInStage` filtrait le clic sur le plan, et rien d'autre. Tout le
 * reste passait à côté : l'inspecteur ne recevait même pas l'espace actif,
 * donc il proposait « Supprimer » sur une parcelle depuis Bâtiment ; le menu
 * contextuel se construisait sans lui ; `Delete` allait droit à la commande.
 * Une sélection obtenue par Ctrl+K, par l'arborescence ou par un constat
 * contournait donc l'unique verrou qui existait.
 *
 * La règle est maintenant portée par l'objet et non par le chemin : quel que
 * soit le geste — clic, poignée, inspecteur, menu, raccourci, palette,
 * arborescence, centre des constats —, il aboutit à une commande, et une
 * commande est refusée si elle touche un objet d'un autre espace.
 *
 * ## Ce qui n'a pas de propriétaire, et pourquoi
 *
 * Une cote et une annotation se corrigent là où on les lit : ce sont des
 * choses dites **sur** le dessin, pas des parties de la maison. Leur donner un
 * propriétaire obligerait à changer d'onglet pour déplacer un texte, ce qui
 * est exactement le genre de trajet que cette règle existe pour supprimer.
 * `undefined` est donc une réponse, et elle veut dire « partout ».
 *
 * Elle veut aussi dire « partout » pour un objet qu'on ne reconnaît pas. Un
 * objet que personne ne revendique ne doit être bloqué par personne, sans quoi
 * une famille ajoutée demain deviendrait un objet visible que plus rien ne
 * peut corriger.
 */
import type {
  ComponentCategory,
  Project,
} from '@house-technical-designer/core-domain';

import type { CreationStageId } from './creation-stages.js';
import { inspectObject, type ObjectKind } from '../editor/object-editors.js';

/**
 * L'espace propriétaire de chaque famille.
 *
 * Écrit en toutes lettres, et exhaustif par construction : ajouter une famille
 * à `ObjectKind` sans lui donner d'espace ne compile pas. C'est la seule
 * protection qui tienne — une table qui se complète toute seule laisse passer
 * la famille qu'on vient d'ajouter, c'est-à-dire celle dont on n'a pas encore
 * réfléchi à la place.
 */
export const OWNER_OF_KIND: Readonly<
  Record<ObjectKind, CreationStageId | undefined>
> = {
  SITE: 'SITE',

  WALL: 'BUILDING',
  SPACE: 'BUILDING',
  OPENING: 'BUILDING',
  SLAB: 'BUILDING',
  SLAB_HOLE: 'BUILDING',
  STAIR: 'BUILDING',
  ROOF: 'BUILDING',
  ROOF_STRUCTURE: 'BUILDING',
  STRUCTURE: 'BUILDING',

  NETWORK_EDGE: 'SYSTEMS',
  NETWORK_NODE: 'SYSTEMS',

  // Un objet posé est d'Aménagement ou de Systèmes selon ce qu'il est : c'est
  // sa catégorie qui tranche, pas sa famille. Voir `OWNER_OF_CATEGORY`.
  COMPONENT: undefined,

  // Dites sur le dessin, corrigées là où on les lit.
  DIMENSION: undefined,
  NOTE: undefined,
};

/**
 * L'espace propriétaire d'un objet posé, par ce qu'il est.
 *
 * La ligne de partage est celle que quelqu'un trace en parlant de sa maison :
 * ce qu'on installe et qui marche tout seul — un lit, un évier, un
 * lave-linge — appartient à l'aménagement ; ce qui est raccordé à un réseau et
 * dimensionné par un calcul appartient aux systèmes.
 *
 * `OTHER` ne dit rien de son métier, et n'a donc pas de propriétaire. Lui en
 * donner un — l'Aménagement, par exemple, parce qu'on y pose des choses —
 * inventerait une discipline que le projet n'a pas déclarée, et se retournerait
 * aussitôt : la nomenclature offre des familles `OTHER` **depuis** la
 * sous-partie Électricité des Systèmes, et un variateur posé là se serait fait
 * refuser par l'espace qui venait de le proposer. C'est la même réponse que
 * `domainOfComponentCategory`, qui ne lui attribue aucun métier non plus.
 */
export const OWNER_OF_CATEGORY: Readonly<
  Record<ComponentCategory, CreationStageId | undefined>
> = {
  FURNITURE: 'FITTING',
  SANITARY: 'FITTING',
  APPLIANCE: 'FITTING',
  OTHER: undefined,

  HEATING: 'SYSTEMS',
  VENTILATION: 'SYSTEMS',
  ELECTRICAL: 'SYSTEMS',
  LIGHTING: 'SYSTEMS',
  PHOTOVOLTAIC: 'SYSTEMS',
};

/**
 * Ce que la nomenclature sait et que `ComponentCategory` ne sait pas.
 *
 * La catégorie grossière compte neuf valeurs pour cinq cents familles, et une
 * seule de ses cases est vraiment ambiguë : `SANITARY`. Elle range ensemble
 * l'appareil qu'on pose en meublant une salle de bain — un WC, un lavabo, une
 * douche — et l'ouvrage de plomberie qui le dessert : la chute, le siphon, le
 * collecteur, le mitigeur, le ballon. Les premiers appartiennent à
 * l'Aménagement, les seconds aux Systèmes, et la catégorie les envoyait tous
 * du même côté.
 *
 * La catégorie **fine** les distingue depuis toujours : `SANITARY_FIXTURE`
 * d'un côté, `DRAINAGE`, `FITTING`, `VALVE`, `DHW_TANK` de l'autre. La donnée
 * existait ; c'est la règle qui ne la lisait pas.
 *
 * Elle ne tranche que ce cas-là. Un premier essai faisait décider le domaine
 * de la famille pour toutes : un réfrigérateur passait alors aux Systèmes
 * parce qu'il est électrique, et une prise extérieure au Terrain parce que sa
 * fiche est rangée là. La catégorie grossière avait raison sur ces deux-là ;
 * une règle générale qui casse ce qui marchait n'est pas une règle générale.
 *
 * Elle ne lit rien du catalogue, et c'est délibéré : `ownership.ts` est du
 * premier écran, et y importer le registre des familles y faisait entrer les
 * cinq cent vingt-sept fiches — soixante et onze kio mesurés. Le projet porte
 * déjà la copie de fiche avec laquelle il a été conçu, catégorie fine
 * comprise ; c'est elle qu'on lit, et c'est la bonne, puisque c'est celle
 * d'après laquelle l'objet a été posé.
 */
const FURNISHED_FINE_CATEGORY = 'SANITARY_FIXTURE';

export function stageOfFineCategory(
  fine: string | undefined,
  coarse: ComponentCategory | undefined,
): CreationStageId | undefined {
  if (coarse !== 'SANITARY') return undefined;
  return fine === FURNISHED_FINE_CATEGORY ? 'FITTING' : 'SYSTEMS';
}

/** La catégorie fine de la fiche qu'un objet posé désigne, s'il en désigne une. */
function fineCategoryOf(
  project: Project,
  objectId: string,
): string | undefined {
  for (const level of project.building.levels)
    for (const component of level.components ?? [])
      if (component.id === objectId) {
        const definitionId = component.definitionId;
        if (definitionId === undefined) return undefined;
        return (project.equipment ?? []).find(({ id }) => id === definitionId)
          ?.category;
      }
  return undefined;
}

function categoryOf(
  project: Project,
  objectId: string,
): ComponentCategory | undefined {
  for (const level of project.building.levels)
    for (const component of level.components ?? [])
      if (component.id === objectId) return component.category;
  return undefined;
}

/**
 * L'espace depuis lequel cet objet se modifie, ou `undefined` s'il se modifie
 * partout.
 *
 * `undefined` n'est jamais un aveu d'ignorance qu'on traiterait comme un
 * refus : c'est une permission. Voir l'en-tête de ce module.
 */
export function ownerStageOf(
  project: Project,
  objectId: string,
): CreationStageId | undefined {
  const { kind } = inspectObject(project, objectId);
  if (kind === 'UNKNOWN') return undefined;
  if (kind !== 'COMPONENT') return OWNER_OF_KIND[kind];
  /*
   * La nomenclature d'abord, la catégorie grossière ensuite.
   *
   * `ComponentCategory` compte neuf valeurs pour cinq cents familles : elle
   * range la chute d'évacuation, le collecteur et le mitigeur avec le lavabo,
   * sous « sanitaire ». La nomenclature, elle, les distingue depuis toujours.
   * On lui demande donc en premier, et on retombe sur la catégorie pour ce qui
   * ne vient d'aucune fiche.
   */
  const category = categoryOf(project, objectId);
  const refined = stageOfFineCategory(
    fineCategoryOf(project, objectId),
    category,
  );
  if (refined !== undefined) return refined;
  return category === undefined ? undefined : OWNER_OF_CATEGORY[category];
}

/**
 * Si cet espace peut modifier cet objet.
 *
 * Modifier veut dire tout ce qui écrit dans le projet : déplacer, corriger un
 * champ, tirer une poignée, supprimer. Il n'y a pas de droit plus fin, parce
 * qu'il n'y a pas de raison qu'il y en ait : un espace qui peut déplacer un
 * mur peut le corriger, et un espace qui ne le possède pas ne fait ni l'un ni
 * l'autre.
 */
export function canEdit(
  stage: CreationStageId,
  project: Project,
  objectId: string,
): boolean {
  const owner = ownerStageOf(project, objectId);
  return owner === undefined || owner === stage;
}

/**
 * Si cet espace peut consulter cet objet.
 *
 * Toujours. C'est le point : un objet reste lisible et localisable partout,
 * et c'est ce qui permet de ne plus jamais avoir à le rendre modifiable pour
 * qu'il soit atteignable. La fonction existe pour que les appelants disent ce
 * qu'ils demandent, et pour que la règle ait un endroit où changer si elle
 * change un jour.
 */
export function canInspect(): boolean {
  return true;
}

/**
 * Les objets d'une sélection que cet espace ne peut pas modifier.
 *
 * Rendue en entier plutôt qu'en booléen : un refus qui ne dit pas sur quoi il
 * porte oblige à deviner lequel des huit objets pris à la bande a bloqué le
 * geste.
 */
export function unownedIn(
  stage: CreationStageId,
  project: Project,
  objectIds: readonly string[],
): readonly string[] {
  return objectIds.filter((objectId) => !canEdit(stage, project, objectId));
}
