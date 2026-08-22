/**
 * Where the person is, and where a target sends them.
 *
 * The rail chooses a space; the context panel chooses what is being done
 * inside it. Keeping the second per space is what makes the rail a rail rather
 * than a reset button: leaving Analyser on « Quantités » and coming back to
 * Analyser has to come back to Quantités, or the five spaces would cost more
 * clicks than the eleven destinations they replace.
 */
import {
  defaultTabOfWorkspace,
  legacyTabsOfWorkspace,
  PRIMARY_WORKSPACES,
  workspaceOfDomain,
  workspaceOfLegacyTab,
  type LegacyWorkspaceTab,
  type PrimaryWorkspace,
} from './workspaces.js';
import type { UiTarget } from './ui-target.js';

export interface ShellNavigation {
  readonly workspace: PrimaryWorkspace;
  /** What was last open in each space, so returning to one returns to it. */
  readonly tabs: Readonly<Record<PrimaryWorkspace, LegacyWorkspaceTab>>;
}

export const DEFAULT_SHELL_NAVIGATION: ShellNavigation = {
  workspace: 'BUILD',
  tabs: Object.fromEntries(
    PRIMARY_WORKSPACES.map((workspace) => [
      workspace,
      defaultTabOfWorkspace(workspace),
    ]),
  ) as Readonly<Record<PrimaryWorkspace, LegacyWorkspaceTab>>,
};

/** What is open right now. */
export function activeTab(navigation: ShellNavigation): LegacyWorkspaceTab {
  return navigation.tabs[navigation.workspace];
}

export function goToWorkspace(
  navigation: ShellNavigation,
  workspace: PrimaryWorkspace,
): ShellNavigation {
  return navigation.workspace === workspace
    ? navigation
    : { ...navigation, workspace };
}

/**
 * Open a destination, wherever it lives.
 *
 * The space follows from the destination rather than the other way round: a
 * command palette entry says « Quantités » and does not have to know that
 * quantities are read in Analyser.
 */
export function goToTab(
  navigation: ShellNavigation,
  tab: LegacyWorkspaceTab,
): ShellNavigation {
  const workspace = workspaceOfLegacyTab(tab);
  return {
    workspace,
    tabs: { ...navigation.tabs, [workspace]: tab },
  };
}

/**
 * The navigation a target asks for.
 *
 * Only the part of a target that concerns the shell is read here — the space
 * and the discipline. Selecting the object, framing it and expanding its
 * property are the canvas's and the inspector's share of the same target, and
 * they happen alongside rather than instead.
 */
export function navigationFor(
  navigation: ShellNavigation,
  target: UiTarget,
): ShellNavigation {
  const workspace =
    target.workspace ??
    (target.domain === undefined
      ? undefined
      : workspaceOfDomain(target.domain));
  if (workspace === undefined) return navigation;
  const wanted = navigation.tabs[workspace];
  // Entering a space to reach an object opens what that space is for, not
  // whatever was last read in it: a check about a wall must not land on the
  // materials list because that is where someone was yesterday.
  const tab =
    target.objectId === undefined ? wanted : defaultTabOfWorkspace(workspace);
  return { workspace, tabs: { ...navigation.tabs, [workspace]: tab } };
}

/**
 * Whether a destination is the one on screen.
 *
 * Read through the space rather than compared directly, so that a destination
 * remembered in a space nobody is standing in is not shown as current.
 */
export function isTabActive(
  navigation: ShellNavigation,
  tab: LegacyWorkspaceTab,
): boolean {
  return activeTab(navigation) === tab;
}

/** Every destination, per space, in the order the panel lists them. */
export function destinationsOf(
  workspace: PrimaryWorkspace,
): readonly LegacyWorkspaceTab[] {
  return legacyTabsOfWorkspace(workspace);
}
