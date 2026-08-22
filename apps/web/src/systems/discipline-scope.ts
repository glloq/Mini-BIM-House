/**
 * Which trades Systèmes offers, and how much of each the project holds.
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
import { workspaceOfDomain } from '../ux/workspaces.js';

/**
 * The technical trades this project is worth reading through.
 *
 * A trade the project has switched off is not offered, unless the project
 * already holds objects of it: a scope narrows what is proposed, never what
 * exists.
 */
export function technicalDomains(project: Project): readonly DesignDomainId[] {
  const inPlay = domainsInPlay(project);
  return DESIGN_DOMAIN_IDS.filter(
    (id) => workspaceOfDomain(id) === 'SYSTEMS' && inPlay.has(id),
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
