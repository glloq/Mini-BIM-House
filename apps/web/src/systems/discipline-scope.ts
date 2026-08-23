/**
 * Which trades a stage offers, and how much of each the project holds.
 *
 * Separated from the component because a count of runs is a fact about the
 * project, not a way of drawing a button — and because the command palette and
 * the workflow guide need the same answer.
 */
import {
  DESIGN_DOMAIN_IDS,
  domainOfDiscipline,
  type DesignDomainId,
  type Project,
} from '@house-technical-designer/core-domain';

import { domainsInPlay } from '../ux/scope-filter.js';
import {
  creationStage,
  stageOfDomain,
  type CreationStageId,
} from '../ux/creation-stages.js';

/**
 * Les métiers qu'une étape propose de lire, et que le projet fait vivre.
 *
 * Un métier que le projet a désactivé n'est pas proposé — sauf si le projet en
 * tient déjà des objets : un périmètre restreint ce qu'on propose, jamais ce
 * qui existe.
 *
 * L'ordre est celui du registre des étapes : c'est là qu'on décide qu'on
 * commence par l'eau et qu'on finit par la sécurité.
 */
export function domainsOfStage(
  project: Project,
  stage: CreationStageId,
): readonly DesignDomainId[] {
  const inPlay = domainsInPlay(project);
  return creationStage(stage).domains.filter((id) => inPlay.has(id));
}

/**
 * The technical trades this project is worth reading through.
 *
 * Ceux de l'étape Systèmes : la question « quelles disciplines techniques ce
 * projet fait-il vivre » se pose ailleurs que dans le panneau — la palette et
 * le guide la posent aussi.
 */
export function technicalDomains(project: Project): readonly DesignDomainId[] {
  const inPlay = domainsInPlay(project);
  return DESIGN_DOMAIN_IDS.filter(
    (id) => stageOfDomain(id) === 'SYSTEMS' && inPlay.has(id),
  );
}

/** How many runs of a trade the project holds, so a count can be shown. */
export function networksOfDomain(
  project: Project,
  domain: DesignDomainId,
): number {
  return (project.systems ?? []).filter(
    (network) => domainOfDiscipline(network.discipline) === domain,
  ).length;
}
