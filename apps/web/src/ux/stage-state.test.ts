import { describe, expect, it } from 'vitest';

import {
  CREATION_STAGES,
  defaultTabOfStage,
  stageOfTab,
} from './creation-stages.js';
import {
  activeDomain,
  activeTab,
  DEFAULT_SHELL_NAVIGATION,
  destinationsOf,
  goToStage,
  goToTab,
  isTabActive,
  navigationFor,
} from './stage-state.js';
import { LEGACY_WORKSPACE_TABS } from './workspaces.js';

describe('the nine stages and the thirteen destinations', () => {
  it('opens on the plan, which is what the application is for', () => {
    expect(DEFAULT_SHELL_NAVIGATION.stage).toBe('BUILDING');
    expect(activeTab(DEFAULT_SHELL_NAVIGATION)).toBe('plan');
  });

  it('reaches every destination through its stage', () => {
    for (const tab of LEGACY_WORKSPACE_TABS) {
      const navigation = goToTab(DEFAULT_SHELL_NAVIGATION, tab);
      expect(navigation.stage).toBe(stageOfTab(tab));
      expect(activeTab(navigation)).toBe(tab);
      expect(isTabActive(navigation, tab)).toBe(true);
      expect(destinationsOf(navigation.stage)).toContain(tab);
    }
  });

  it('offers the plan in Systèmes as well, which is what that stage is', () => {
    // Systèmes est le même dessin avec une discipline allumée. Une étape qui
    // emmènerait loin du modèle pour montrer ses réseaux serait les treize
    // destinations à nouveau, sous neuf noms.
    expect(destinationsOf('SYSTEMS')).toContain('plan');
    expect(destinationsOf('SYSTEMS')).toContain('networks');
    expect(defaultTabOfStage('SYSTEMS')).toBe('plan');
  });

  it('gives every stage at least one destination and a default', () => {
    for (const stage of CREATION_STAGES) {
      const destinations = destinationsOf(stage);
      expect(destinations.length).toBeGreaterThan(0);
      expect(destinations).toContain(defaultTabOfStage(stage));
    }
  });

  it('comes back to what was left open in a stage', () => {
    const afterQuantities = goToTab(DEFAULT_SHELL_NAVIGATION, 'quantities');
    const away = goToStage(afterQuantities, 'BUILDING');
    expect(activeTab(away)).toBe('plan');
    const back = goToStage(away, 'CHECKS');
    expect(activeTab(back)).toBe('quantities');
  });

  it('does not rebuild the state when the stage does not change', () => {
    expect(goToStage(DEFAULT_SHELL_NAVIGATION, 'BUILDING')).toBe(
      DEFAULT_SHELL_NAVIGATION,
    );
  });

  it('follows a target to its stage, by name or by trade', () => {
    expect(
      navigationFor(DEFAULT_SHELL_NAVIGATION, { stage: 'DOCUMENTS' }),
    ).toMatchObject({ stage: 'DOCUMENTS' });
    expect(
      navigationFor(DEFAULT_SHELL_NAVIGATION, { domain: 'ELECTRICAL' }).stage,
    ).toBe('SYSTEMS');
  });

  it('remembers the trade a stage was read through', () => {
    const power = navigationFor(DEFAULT_SHELL_NAVIGATION, {
      domain: 'ELECTRICAL',
    });
    expect(activeDomain(power)).toBe('ELECTRICAL');
    // Passer ailleurs et revenir retrouve le métier qu'on y lisait.
    const away = goToStage(power, 'BUILDING');
    expect(activeDomain(away)).toBe('ARCHITECTURE');
    expect(activeDomain(goToStage(away, 'SYSTEMS'))).toBe('ELECTRICAL');
  });

  it('proposes the first trade of a stage when none was chosen', () => {
    expect(activeDomain(goToStage(DEFAULT_SHELL_NAVIGATION, 'SYSTEMS'))).toBe(
      'PLUMBING',
    );
    // Une étape sans métier n'en invente pas un.
    expect(activeDomain(goToStage(DEFAULT_SHELL_NAVIGATION, 'CHECKS'))).toBe(
      undefined,
    );
  });

  it('leaves the navigation alone when a target says nothing about a place', () => {
    const navigation = goToTab(DEFAULT_SHELL_NAVIGATION, 'quantities');
    expect(navigationFor(navigation, { objectId: 'wall-1' })).toBe(navigation);
    expect(navigationFor(navigation, {})).toBe(navigation);
  });

  it('opens what a stage is for when it is entered to reach an object', () => {
    // Quelqu'un lisait la liste des matériaux dans Bâtiment ; une
    // vérification qui parle d'un mur ne doit pas y atterrir.
    const navigation = goToTab(DEFAULT_SHELL_NAVIGATION, 'materials');
    const sent = navigationFor(navigation, {
      stage: 'BUILDING',
      objectId: 'wall-1',
    });
    expect(activeTab(sent)).toBe('plan');
  });

  it('keeps the remembered destination when the target names no object', () => {
    const navigation = goToTab(DEFAULT_SHELL_NAVIGATION, 'materials');
    const sent = navigationFor(navigation, { stage: 'BUILDING' });
    expect(activeTab(sent)).toBe('materials');
  });
});
