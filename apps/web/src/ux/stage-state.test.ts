import { describe, expect, it } from 'vitest';

import {
  CREATION_STAGES,
  defaultTabOfStage,
  stageOfTab,
  tabsOfStage,
} from './creation-stages.js';
import {
  activeDomain,
  activeSectionId,
  activeTab,
  DEFAULT_SHELL_NAVIGATION,
  destinationsOf,
  goToSection,
  goToStage,
  goToTab,
  isTabActive,
  navigationFor,
  type ShellNavigation,
} from './stage-state.js';
import { DESTINATIONS } from './destinations.js';

describe('the nine stages and the thirteen destinations', () => {
  it('opens on the plan, which is what the application is for', () => {
    expect(DEFAULT_SHELL_NAVIGATION.stage).toBe('BUILDING');
    expect(activeTab(DEFAULT_SHELL_NAVIGATION)).toBe('plan');
  });

  it('stays where it is when the stage already offers the destination', () => {
    // Le plan est offert par sept étapes sur neuf. Sans cette règle, cliquer
    // « Plan » depuis Bâtiment renverrait dans Terrain, qui est simplement la
    // première de la liste à le proposer.
    const site = goToStage(DEFAULT_SHELL_NAVIGATION, 'SITE');
    expect(goToTab(site, 'plan').stage).toBe('SITE');
    expect(goToTab(DEFAULT_SHELL_NAVIGATION, 'plan').stage).toBe('BUILDING');
  });

  it('reaches every destination through its stage', () => {
    for (const tab of DESTINATIONS) {
      const navigation = goToTab(DEFAULT_SHELL_NAVIGATION, tab);
      const expected = tabsOfStage(DEFAULT_SHELL_NAVIGATION.stage).includes(tab)
        ? DEFAULT_SHELL_NAVIGATION.stage
        : stageOfTab(tab);
      expect(navigation.stage).toBe(expected);
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

describe('the sub-part one is working in', () => {
  const BUILDING = [
    { id: 'building.walls', label: 'Murs', domain: 'ARCHITECTURE' as const },
    {
      id: 'building.openings',
      label: 'Ouvertures',
      domain: 'ARCHITECTURE' as const,
    },
    { id: 'structure.frame', label: 'Ossature', domain: 'STRUCTURE' as const },
  ];

  it('opens on the first one, and nothing at all without any', () => {
    expect(activeSectionId(DEFAULT_SHELL_NAVIGATION, BUILDING)).toBe(
      'building.walls',
    );
    expect(activeSectionId(DEFAULT_SHELL_NAVIGATION, [])).toBeUndefined();
  });

  it('remembers the one left open, per space', () => {
    const openings = goToSection(DEFAULT_SHELL_NAVIGATION, BUILDING[1]!);
    expect(activeSectionId(openings, BUILDING)).toBe('building.openings');
    // Et repasser par ailleurs n'y touche pas : une rangée qui se remet à zéro
    // à chaque aller-retour coûte plus de clics qu'elle n'en épargne.
    const away = goToStage(openings, 'DOCUMENTS');
    expect(activeSectionId(goToStage(away, 'BUILDING'), BUILDING)).toBe(
      'building.openings',
    );
  });

  it('makes choosing a sub-part choose its trade', () => {
    // Dans Systèmes, « Eau » *est* la plomberie : deux gestes pour une seule
    // décision sont un geste de trop.
    const frame = goToSection(DEFAULT_SHELL_NAVIGATION, BUILDING[2]!);
    expect(activeDomain(frame)).toBe('STRUCTURE');
  });

  it('follows the trade when the trade is chosen elsewhere', () => {
    // La barre de vue et la rangée disent la même chose. Plutôt que de les
    // synchroniser — deux sources qui se répondent finissent par se
    // contredire — la sous-partie se dérive du métier lu.
    const walls = goToSection(DEFAULT_SHELL_NAVIGATION, BUILDING[0]!);
    const structural: ShellNavigation = {
      ...walls,
      domains: { ...walls.domains, BUILDING: 'STRUCTURE' },
    };
    expect(activeSectionId(structural, BUILDING)).toBe('structure.frame');
  });

  it('keeps a sub-part that names no trade whatever the trade is', () => {
    const plain = [{ id: 'documents.annotation', label: 'Annotation' }];
    const somewhere = goToSection(DEFAULT_SHELL_NAVIGATION, plain[0]!);
    expect(activeSectionId(somewhere, plain)).toBe('documents.annotation');
  });

  it('never names a sub-part the space no longer offers', () => {
    // Un projet qui perd son catalogue perd des sous-parties : celle qu'on
    // avait ouverte ne doit pas rester désignée dans le vide.
    const gone = goToSection(DEFAULT_SHELL_NAVIGATION, {
      id: 'systems.solar',
      domain: 'SOLAR',
    });
    expect(activeSectionId(gone, BUILDING)).toBe('building.walls');
  });
});
