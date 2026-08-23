/**
 * Où en est la personne, et où un renvoi l'emmène.
 *
 * La barre d'étapes choisit ce qu'on est en train de faire ; le panneau gauche
 * choisit ce qu'on regarde à l'intérieur. Garder le second par étape est ce qui
 * fait de la barre une barre et non un bouton de remise à zéro : quitter
 * Vérifier sur « Quantités » et y revenir doit revenir sur Quantités, sinon
 * neuf étapes coûteraient plus de clics que les treize destinations qu'elles
 * remplacent.
 *
 * La discipline active se souvient elle aussi : elle appartient à l'étape qui
 * la propose, et repasser par Systèmes retrouve le métier qu'on y lisait.
 */
import type { DesignDomainId } from '@house-technical-designer/core-domain';

import {
  CREATION_STAGES,
  creationStage,
  defaultDomainOfStage,
  defaultTabOfStage,
  stageOfDomain,
  stageOfTab,
  tabsOfStage,
  type CreationStageId,
} from './creation-stages.js';
import type { UiTarget } from './ui-target.js';
import type { WorkflowGroup } from './workflow-steps.js';
import type { LegacyWorkspaceTab } from './workspaces.js';

export interface ShellNavigation {
  readonly stage: CreationStageId;
  /** Ce qui était ouvert dans chaque étape, pour y revenir tel qu'on l'a laissé. */
  readonly tabs: Readonly<Record<CreationStageId, LegacyWorkspaceTab>>;
  /** Le métier lu dans chaque étape qui en propose plusieurs. */
  readonly domains: Readonly<Partial<Record<CreationStageId, DesignDomainId>>>;
}

export const DEFAULT_SHELL_NAVIGATION: ShellNavigation = {
  stage: 'BUILDING',
  tabs: Object.fromEntries(
    CREATION_STAGES.map((stage) => [stage, defaultTabOfStage(stage)]),
  ) as Readonly<Record<CreationStageId, LegacyWorkspaceTab>>,
  domains: {},
};

/** Ce qui est ouvert en ce moment. */
export function activeTab(navigation: ShellNavigation): LegacyWorkspaceTab {
  return navigation.tabs[navigation.stage];
}

/**
 * Le métier par lequel le plan se lit en ce moment.
 *
 * Celui qu'on lisait dans cette étape, sinon celui qu'elle propose d'abord.
 * Une étape sans métier — Projet, Vérifier, Documents — n'en a pas, et le plan
 * s'y lit tel qu'il est.
 */
export function activeDomain(
  navigation: ShellNavigation,
): DesignDomainId | undefined {
  const remembered = navigation.domains[navigation.stage];
  if (remembered !== undefined) return remembered;
  return defaultDomainOfStage(navigation.stage);
}

export function goToStage(
  navigation: ShellNavigation,
  stage: CreationStageId,
): ShellNavigation {
  return navigation.stage === stage ? navigation : { ...navigation, stage };
}

/**
 * Ouvrir une destination, où qu'elle vive.
 *
 * L'étape suit de la destination plutôt que l'inverse : une entrée de palette
 * dit « Quantités » sans avoir à savoir que les quantités se lisent dans
 * Vérifier.
 *
 * Mais **on ne quitte pas une étape qui offre déjà la destination**. Le plan
 * est offert par sept étapes sur neuf ; sans cette règle, cliquer « Plan »
 * depuis Bâtiment renvoyait dans Terrain, qui est simplement la première de la
 * liste à le proposer.
 */
export function goToTab(
  navigation: ShellNavigation,
  tab: LegacyWorkspaceTab,
): ShellNavigation {
  const stage = tabsOfStage(navigation.stage).includes(tab)
    ? navigation.stage
    : stageOfTab(tab);
  return { ...navigation, stage, tabs: { ...navigation.tabs, [stage]: tab } };
}

/**
 * La navigation qu'un renvoi demande.
 *
 * Seule la part du renvoi qui concerne la coque est lue ici — l'étape et le
 * métier. Sélectionner l'objet, le cadrer et déplier sa propriété sont la part
 * du canvas et de l'inspecteur dans le même renvoi, et se font à côté plutôt
 * qu'à la place.
 */
export function navigationFor(
  navigation: ShellNavigation,
  target: UiTarget,
): ShellNavigation {
  const stage =
    target.stage ??
    (target.domain === undefined ? undefined : stageOfDomain(target.domain));
  if (stage === undefined) return navigation;
  const domains =
    target.domain === undefined
      ? navigation.domains
      : { ...navigation.domains, [stage]: target.domain };
  // Entrer dans une étape pour atteindre un objet ouvre ce à quoi l'étape
  // sert, et non ce qu'on y lisait la dernière fois : une vérification qui
  // parle d'un mur ne doit pas atterrir sur la liste des matériaux parce que
  // c'est là qu'on était hier.
  const tab =
    target.objectId === undefined
      ? navigation.tabs[stage]
      : defaultTabOfStage(stage);
  return { stage, tabs: { ...navigation.tabs, [stage]: tab }, domains };
}

/**
 * Si une destination est celle qui est à l'écran.
 *
 * Lue à travers l'étape plutôt que comparée directement, pour qu'une
 * destination retenue dans une étape où personne ne se tient ne s'affiche pas
 * comme courante.
 */
export function isTabActive(
  navigation: ShellNavigation,
  tab: LegacyWorkspaceTab,
): boolean {
  return activeTab(navigation) === tab;
}

/** Tout ce qu'une étape ouvre : ses destinations et ses bibliothèques. */
export function destinationsOf(
  stage: CreationStageId,
): readonly LegacyWorkspaceTab[] {
  return tabsOfStage(stage);
}

/** Ce que l'étape courante s'appelle, pour un titre ou un lecteur d'écran. */
export function activeStageLabel(navigation: ShellNavigation): string {
  return creationStage(navigation.stage).label;
}

/**
 * Ce qu'il reste à faire dans chaque étape.
 *
 * Les dix phases disent ce qu'il reste ; les neuf étapes disent ce qu'on fait.
 * Ce compte est le pont entre les deux : il met un nombre sur l'étape, et rien
 * d'autre. Ce n'est pas un barrage — on peut travailler dans une étape qui
 * n'affiche rien, et laisser une étape qui affiche cinq.
 *
 * `NOT_APPLICABLE` et `DONE` ne comptent pas : une maison sans photovoltaïque
 * n'a rien à faire du photovoltaïque, et lui compter une tâche inventerait du
 * travail que personne n'a demandé.
 */
export function remainingByStage(
  entries: readonly { readonly group: WorkflowGroup; readonly state: string }[],
): Readonly<Partial<Record<CreationStageId, number>>> {
  const stageOfGroup = new Map<WorkflowGroup, CreationStageId>();
  for (const stage of CREATION_STAGES)
    for (const group of creationStage(stage).groups)
      stageOfGroup.set(group, stage);
  const counts: Partial<Record<CreationStageId, number>> = {};
  for (const entry of entries) {
    if (entry.state === 'DONE' || entry.state === 'NOT_APPLICABLE') continue;
    const stage = stageOfGroup.get(entry.group);
    if (stage === undefined) continue;
    counts[stage] = (counts[stage] ?? 0) + 1;
  }
  return counts;
}
