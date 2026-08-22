import { describe, expect, it } from 'vitest';

import {
  activeTab,
  DEFAULT_SHELL_NAVIGATION,
  destinationsOf,
  goToTab,
  goToWorkspace,
  isTabActive,
  navigationFor,
} from './navigation-state.js';
import {
  LEGACY_WORKSPACE_TABS,
  PRIMARY_WORKSPACES,
  defaultTabOfWorkspace,
  workspaceOfLegacyTab,
} from './workspaces.js';

describe('the rail and the eleven destinations', () => {
  it('opens on the plan, which is what the application is for', () => {
    expect(DEFAULT_SHELL_NAVIGATION.workspace).toBe('BUILD');
    expect(activeTab(DEFAULT_SHELL_NAVIGATION)).toBe('plan');
  });

  it('reaches every old destination through its space', () => {
    for (const tab of LEGACY_WORKSPACE_TABS) {
      const navigation = goToTab(DEFAULT_SHELL_NAVIGATION, tab);
      expect(navigation.workspace).toBe(workspaceOfLegacyTab(tab));
      expect(activeTab(navigation)).toBe(tab);
      expect(isTabActive(navigation, tab)).toBe(true);
      expect(destinationsOf(navigation.workspace)).toContain(tab);
    }
  });

  it('offers the plan in Systèmes as well, which is what that space is', () => {
    // Systèmes is the same drawing with one discipline switched on. A space
    // that took you away from the model to show its networks would be the
    // eleven destinations again, wearing five names.
    expect(destinationsOf('SYSTEMS')).toContain('plan');
    expect(destinationsOf('SYSTEMS')).toContain('networks');
    expect(defaultTabOfWorkspace('SYSTEMS')).toBe('plan');
  });

  it('gives every space at least one destination and a default', () => {
    for (const workspace of PRIMARY_WORKSPACES) {
      const destinations = destinationsOf(workspace);
      expect(destinations.length).toBeGreaterThan(0);
      expect(destinations).toContain(defaultTabOfWorkspace(workspace));
    }
  });

  it('comes back to what was left open in a space', () => {
    const afterQuantities = goToTab(DEFAULT_SHELL_NAVIGATION, 'quantities');
    const away = goToWorkspace(afterQuantities, 'BUILD');
    expect(activeTab(away)).toBe('plan');
    const back = goToWorkspace(away, 'ANALYZE');
    expect(activeTab(back)).toBe('quantities');
  });

  it('does not rebuild the state when the space does not change', () => {
    expect(goToWorkspace(DEFAULT_SHELL_NAVIGATION, 'BUILD')).toBe(
      DEFAULT_SHELL_NAVIGATION,
    );
  });

  it('follows a target to its space, by name or by trade', () => {
    expect(
      navigationFor(DEFAULT_SHELL_NAVIGATION, { workspace: 'DOCUMENTS' }),
    ).toMatchObject({ workspace: 'DOCUMENTS' });
    expect(
      navigationFor(DEFAULT_SHELL_NAVIGATION, { domain: 'ELECTRICAL' })
        .workspace,
    ).toBe('SYSTEMS');
  });

  it('leaves the navigation alone when a target says nothing about a place', () => {
    const navigation = goToTab(DEFAULT_SHELL_NAVIGATION, 'quantities');
    expect(navigationFor(navigation, { objectId: 'wall-1' })).toBe(navigation);
    expect(navigationFor(navigation, {})).toBe(navigation);
  });

  it('opens what a space is for when it is entered to reach an object', () => {
    // Someone last read the materials list in Construire; a check about a wall
    // must not land there.
    const navigation = goToTab(DEFAULT_SHELL_NAVIGATION, 'materials');
    const sent = navigationFor(navigation, {
      workspace: 'BUILD',
      objectId: 'wall-1',
    });
    expect(activeTab(sent)).toBe('plan');
  });

  it('keeps the remembered destination when the target names no object', () => {
    const navigation = goToTab(DEFAULT_SHELL_NAVIGATION, 'materials');
    const sent = navigationFor(navigation, { workspace: 'BUILD' });
    expect(activeTab(sent)).toBe('materials');
  });
});
