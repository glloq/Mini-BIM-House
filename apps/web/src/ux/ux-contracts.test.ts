import {
  DESIGN_DOMAIN_IDS,
  designDomain,
  isDesignDomainId,
  isProjectIntent,
  PROJECT_INTENTS,
  type DesignDomainId,
} from '@house-technical-designer/core-domain';
import { CALCULATION_MODULES } from '@house-technical-designer/calculation-adapters';
import { describe, expect, it } from 'vitest';

import {
  INITIAL_SHAPE_KINDS,
  INITIAL_SHAPE_LABELS,
  LEVEL_DRAFT_KINDS,
  LEVEL_DRAFT_KIND_LABELS,
  PROJECT_START_MODES,
  PROJECT_START_MODE_REGISTRY,
  isProjectStartMode,
} from './new-project-draft.js';
import {
  describeTarget,
  isEmptyTarget,
  locationAfter,
  targetReach,
  type UiLocation,
} from './ui-target.js';
import {
  WORKFLOW_GROUPS,
  WORKFLOW_GROUP_LABELS,
  WORKFLOW_STEP_BY_ID,
  WORKFLOW_STEP_DEFINITIONS,
  WORKFLOW_STEP_IDS,
  WORKFLOW_STEP_STATES,
  WORKFLOW_STEP_STATE_LABELS,
  isWorkflowStepId,
} from './workflow-steps.js';
import {
  CREATION_STAGES,
  creationStage,
  isCreationStage,
  stageOfDomain,
  stageOfTab,
  tabsOfStage,
} from './creation-stages.js';
import { DESTINATIONS } from './destinations.js';

describe('the nine creation stages', () => {
  it('are nine, in the order of a building site', () => {
    expect(CREATION_STAGES).toHaveLength(9);
    expect([...CREATION_STAGES]).toEqual([
      'PROJECT',
      'SITE',
      'BUILDING',
      'STRUCTURE',
      'FITTING',
      'SYSTEMS',
      'ENERGY',
      'CHECKS',
      'DOCUMENTS',
    ]);
  });

  it('give each stage a distinct one-letter accelerator', () => {
    const shortcuts = CREATION_STAGES.map((id) => creationStage(id).shortcut);
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
    for (const shortcut of shortcuts) expect(shortcut).toHaveLength(1);
  });

  it('never put a library, a quantity or a check in the stage bar', () => {
    // Une bibliothèque est un outil et un résultat n'est pas un lieu : ni
    // l'un ni l'autre n'est une chose qu'on est en train de faire.
    const labels = CREATION_STAGES.map((id) => creationStage(id).label);
    for (const forbidden of [
      'Matériaux',
      'Assemblages',
      'Quantités',
      'Scénarios',
    ])
      expect(labels).not.toContain(forbidden);
  });

  it('keep every one of the thirteen destinations reachable', () => {
    for (const tab of DESTINATIONS) {
      const stage = stageOfTab(tab);
      expect(isCreationStage(stage)).toBe(true);
      expect(tabsOfStage(stage)).toContain(tab);
    }
    expect(DESTINATIONS.length).toBeGreaterThanOrEqual(13);
  });

  it('give every trade a stage to be designed in', () => {
    for (const id of DESIGN_DOMAIN_IDS) {
      const stage = stageOfDomain(id);
      expect(isCreationStage(stage)).toBe(true);
      expect(creationStage(stage).domains).toContain(id);
    }
    expect(stageOfDomain('ELECTRICAL')).toBe('SYSTEMS');
    expect(stageOfDomain('ARCHITECTURE')).toBe('BUILDING');
    expect(stageOfDomain('SITE')).toBe('SITE');
  });

  it('names every trade exactly once across the nine', () => {
    // Deux étapes qui revendiquent le même métier, et « où se dessine
    // l'électricité » redevient une question d'ordre de déclaration.
    const claimed = CREATION_STAGES.flatMap((id) => [
      ...creationStage(id).domains,
    ]);
    expect(new Set(claimed).size).toBe(claimed.length);
    expect(new Set(claimed)).toEqual(new Set(DESIGN_DOMAIN_IDS));
  });

  it('makes a sub-stage of Systèmes a trade, and the others not', () => {
    for (const section of creationStage('SYSTEMS').sections)
      expect(section.domain).toBeDefined();
    for (const section of creationStage('BUILDING').sections)
      expect(section.domain).toBeUndefined();
  });

  it('gives every trade of a stage a name, so a picker never says a bare id', () => {
    for (const stage of CREATION_STAGES)
      for (const id of creationStage(stage).domains)
        expect(designDomain(id).label).not.toBe(id);
  });

  it('refuses a stage that does not exist', () => {
    expect(isCreationStage('MATERIALS')).toBe(false);
    expect(isCreationStage('BUILD')).toBe(false);
  });
});

describe('a navigation target', () => {
  const here: UiLocation = {
    stage: 'BUILDING',
    levelId: 'level-0',
    objectId: 'wall-1',
  };

  it('says how far it is going', () => {
    expect(targetReach(here, {})).toBe('NONE');
    expect(targetReach(here, { stage: 'BUILDING' })).toBe('NONE');
    expect(targetReach(here, { objectId: 'wall-1' })).toBe('NONE');
    expect(targetReach(here, { objectId: 'wall-2' })).toBe('SELECTION');
    expect(targetReach(here, { levelId: 'level-1' })).toBe('LEVEL');
    expect(targetReach(here, { stage: 'SYSTEMS' })).toBe('STAGE');
    expect(targetReach(here, { domain: 'ELECTRICAL' })).toBe('STAGE');
    expect(targetReach(here, { propertyPath: 'heightMm' })).toBe('SELECTION');
  });

  it('leaves unstated what it does not state', () => {
    expect(locationAfter(here, { objectId: 'wall-2' })).toEqual({
      stage: 'BUILDING',
      levelId: 'level-0',
      objectId: 'wall-2',
    });
    expect(locationAfter({ stage: 'PROJECT' }, {})).toEqual({
      stage: 'PROJECT',
    });
  });

  it('can be recognised as pointing nowhere', () => {
    expect(isEmptyTarget({})).toBe(true);
    expect(isEmptyTarget({ overlayId: 'clearances' })).toBe(false);
    expect(isEmptyTarget({ propertyPath: 'uValue' })).toBe(false);
  });

  it('describes the seven things it can carry', () => {
    expect(describeTarget({})).toBe('nulle part');
    expect(
      describeTarget({
        stage: 'SYSTEMS',
        domain: 'ELECTRICAL',
        levelId: 'level-0',
        objectId: 'node-3',
        propertyPath: 'power.w',
        overlayId: 'circuits',
      }),
    ).toBe(
      'étape SYSTEMS, discipline ELECTRICAL, niveau level-0, objet node-3, propriété power.w, calque circuits',
    );
  });
});

describe('the draft a project is created from', () => {
  it('gives every start mode a descriptor', () => {
    for (const mode of PROJECT_START_MODES) {
      const descriptor = PROJECT_START_MODE_REGISTRY[mode];
      expect(descriptor.id).toBe(mode);
      expect(descriptor.label.length).toBeGreaterThan(0);
      expect(descriptor.description.length).toBeGreaterThan(0);
    }
    expect(isProjectStartMode('GUIDED')).toBe(true);
    expect(isProjectStartMode('MAGIC')).toBe(false);
  });

  it('offers a stack richer than « niveaux + sous-sol »', () => {
    expect([...LEVEL_DRAFT_KINDS]).toContain('MEZZANINE');
    expect([...LEVEL_DRAFT_KINDS]).toContain('ATTIC');
    expect([...LEVEL_DRAFT_KINDS]).toContain('TECHNICAL');
    for (const kind of LEVEL_DRAFT_KINDS)
      expect(LEVEL_DRAFT_KIND_LABELS[kind].length).toBeGreaterThan(0);
  });

  it('defaults to drawing rather than to a shape', () => {
    expect(INITIAL_SHAPE_KINDS[0]).toBe('NONE');
    expect(INITIAL_SHAPE_LABELS.NONE).toBe('Je dessinerai moi-même');
    for (const kind of INITIAL_SHAPE_KINDS)
      expect(INITIAL_SHAPE_LABELS[kind].length).toBeGreaterThan(0);
  });
});

describe('the steps of the guide', () => {
  it('are grouped by the ten construction phases', () => {
    expect(WORKFLOW_GROUPS).toHaveLength(10);
    for (const group of WORKFLOW_GROUPS)
      expect(WORKFLOW_GROUP_LABELS[group].length).toBeGreaterThan(0);
  });

  it('are never a navigation destination', () => {
    // Les dix phases disent ce qu'il reste à faire ; les neuf étapes disent ce
    // qu'on est en train de faire. Quelques noms coïncident — ils coïncident
    // comme des mots, pas comme des lieux — et chaque phase est portée par
    // exactement une étape, sinon « il reste des murs à tracer » se lirait à
    // deux endroits.
    const carried = CREATION_STAGES.flatMap((id) => [
      ...creationStage(id).groups,
    ]);
    expect(new Set(carried).size).toBe(carried.length);
    expect(new Set(carried)).toEqual(new Set(WORKFLOW_GROUPS));
    expect(CREATION_STAGES.length).toBeLessThan(WORKFLOW_GROUPS.length);
  });

  it('have unique identifiers, each in a group that exists', () => {
    expect(new Set(WORKFLOW_STEP_IDS).size).toBe(WORKFLOW_STEP_IDS.length);
    for (const step of WORKFLOW_STEP_DEFINITIONS)
      expect(WORKFLOW_GROUPS).toContain(step.group);
    expect(isWorkflowStepId('DRAW_ROOF')).toBe(true);
    expect(isWorkflowStepId('BUILD_A_POOL')).toBe(false);
  });

  it('only depend on steps that exist, and never on themselves', () => {
    for (const step of WORKFLOW_STEP_DEFINITIONS)
      for (const previous of (step as { readonly after?: readonly string[] })
        .after ?? []) {
        expect(isWorkflowStepId(previous)).toBe(true);
        expect(previous).not.toBe(step.id);
      }
  });

  it('only name trades that exist', () => {
    for (const step of WORKFLOW_STEP_DEFINITIONS) {
      const domain = (step as { readonly domain?: string }).domain;
      if (domain !== undefined) expect(isDesignDomainId(domain)).toBe(true);
    }
  });

  it('cover every group with at least one step', () => {
    for (const group of WORKFLOW_GROUPS)
      expect(
        WORKFLOW_STEP_DEFINITIONS.some((step) => step.group === group),
      ).toBe(true);
  });

  it('give every state a label, including the two that are not failures', () => {
    for (const state of WORKFLOW_STEP_STATES)
      expect(WORKFLOW_STEP_STATE_LABELS[state].length).toBeGreaterThan(0);
    expect([...WORKFLOW_STEP_STATES]).toContain('NOT_APPLICABLE');
    expect([...WORKFLOW_STEP_STATES]).toContain('BLOCKED');
  });

  it('find a step by its identifier', () => {
    expect(WORKFLOW_STEP_BY_ID.DRAW_ROOF.group).toBe('CONSTRUCTION');
    expect(WORKFLOW_STEP_BY_ID.PLACE_SOLAR.domain).toBe('SOLAR');
  });
});

describe('the trades and the modules they bring', () => {
  it('only name calculation modules that exist', () => {
    const known = new Set(CALCULATION_MODULES.map(({ id }) => id));
    for (const id of DESIGN_DOMAIN_IDS)
      for (const moduleId of designDomain(id).calculationModules ?? [])
        expect(known.has(moduleId as never)).toBe(true);
  });

  it('leaves no calculation module without a trade to switch it on', () => {
    const claimed = new Set<string>();
    for (const id of DESIGN_DOMAIN_IDS)
      for (const moduleId of designDomain(id).calculationModules ?? [])
        claimed.add(moduleId);
    // A module no trade claims is a module the interface can never offer and
    // never hide: it would sit in Analyser answering a question nobody asked.
    expect(
      CALCULATION_MODULES.map(({ id }) => id).filter((id) => !claimed.has(id)),
    ).toEqual([]);
  });

  it('gives every intent a trade to start from', () => {
    for (const intent of PROJECT_INTENTS) {
      expect(isProjectIntent(intent)).toBe(true);
      const defaults = DESIGN_DOMAIN_IDS.filter((id: DesignDomainId) =>
        (designDomain(id).defaultFor ?? []).includes(intent),
      );
      expect(defaults).toContain('ARCHITECTURE');
    }
  });
});
