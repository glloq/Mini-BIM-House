/**
 * What the scope hides, and what it may never hide.
 *
 * The rule is one sentence: the scope decides what the interface **offers**;
 * it never decides what the project **contains**. A module the project already
 * has results for, or objects for, stays reachable whatever the boxes say —
 * otherwise narrowing a scope would make somebody's own work disappear, which
 * is the one thing a work scope must not do.
 */
import {
  designDomain,
  DESIGN_DOMAIN_IDS,
  domainsPresentIn,
  projectScopeOf,
  type DesignDomainId,
  type Project,
} from '@house-technical-designer/core-domain';

/**
 * The trades that count as in play: those in the scope, plus those the project
 * actually holds objects of.
 */
export function domainsInPlay(project: Project): ReadonlySet<DesignDomainId> {
  const scope = projectScopeOf(project);
  const inPlay = new Set<DesignDomainId>(scope.enabledDomains);
  inPlay.add('ARCHITECTURE');
  for (const id of domainsPresentIn(project)) inPlay.add(id);
  return inPlay;
}

/** The trades that were switched off and hold nothing. */
export function domainsSetAside(project: Project): readonly DesignDomainId[] {
  const inPlay = domainsInPlay(project);
  return DESIGN_DOMAIN_IDS.filter((id) => !inPlay.has(id));
}

/**
 * Whether a calculation module is worth offering on this project.
 *
 * A module no trade in play claims is one whose question nobody on this
 * project is asking. It still runs if it is asked to: this decides what is
 * shown, not what is computed.
 */
export function moduleInScope(project: Project, moduleId: string): boolean {
  const inPlay = domainsInPlay(project);
  for (const id of inPlay)
    if ((designDomain(id).calculationModules ?? []).includes(moduleId))
      return true;
  return false;
}

/** Splits a list of modules into what is offered and what is set aside. */
export function partitionModules<T extends { readonly moduleId: string }>(
  project: Project,
  modules: readonly T[],
): {
  readonly offered: readonly T[];
  readonly setAside: readonly T[];
} {
  const offered: T[] = [];
  const setAside: T[] = [];
  for (const entry of modules)
    (moduleInScope(project, entry.moduleId) ? offered : setAside).push(entry);
  return { offered, setAside };
}
