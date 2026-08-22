import {
  createBuilding,
  createProjectMetadata,
  createSite,
  type Project,
  type ProjectId,
} from '@house-technical-designer/core-domain';
import { describe, expect, it } from 'vitest';

import { loadDemoProject } from '../demo-project.js';
import {
  WORKFLOW_GROUPS,
  WORKFLOW_STEP_BY_ID,
  WORKFLOW_STEP_IDS,
} from '../ux/workflow-steps.js';
import { isEmptyTarget } from '../ux/ui-target.js';
import {
  WORKFLOW_REGISTRY,
  workflowEntries,
  workflowProgress,
} from './workflow-registry.js';

const demo = loadDemoProject();
if (demo.status === 'ERROR') throw new Error(demo.message);
const house = demo.file.project;

const empty: Project = {
  id: 'p' as unknown as ProjectId,
  metadata: createProjectMetadata('Nouveau projet', '2026-01-01T00:00:00.000Z'),
  site: createSite(),
  building: createBuilding(),
};

describe('the registry of steps', () => {
  it('gives every step a descriptor', () => {
    for (const id of WORKFLOW_STEP_IDS) {
      const descriptor = WORKFLOW_REGISTRY[id];
      expect(descriptor.id).toBe(id);
      expect(typeof descriptor.applies).toBe('function');
      expect(typeof descriptor.evaluate).toBe('function');
    }
  });

  it('sends every applicable step somewhere real', () => {
    for (const entry of workflowEntries(house))
      for (const action of entry.actions) {
        expect(isEmptyTarget(action.target)).toBe(false);
        expect(action.label.length).toBeGreaterThan(0);
      }
  });

  it('reads the state from the project and never from a flag', () => {
    // Nothing the guide does may leave a trace: the same project read twice
    // gives the same answer, and a project stripped of its walls loses the
    // step with them.
    const before = workflowEntries(house).map(({ id, state }) => [id, state]);
    expect(workflowEntries(house).map(({ id, state }) => [id, state])).toEqual(
      before,
    );
    expect(JSON.stringify(house)).not.toContain('stepCompleted');

    const stripped: Project = {
      ...house,
      building: {
        ...house.building,
        levels: house.building.levels.map((level) => ({ ...level, walls: [] })),
      },
    };
    const walls = workflowEntries(stripped).find(
      ({ id }) => id === 'DRAW_EXTERIOR_WALLS',
    );
    expect(walls?.state).not.toBe('DONE');
  });

  it('says done about what the demonstration house actually holds', () => {
    const state = new Map(
      workflowEntries(house).map(({ id, state: value }) => [id, value]),
    );
    expect(state.get('DRAW_EXTERIOR_WALLS')).toBe('DONE');
    expect(state.get('NAME_SPACES')).toBe('DONE');
    expect(state.get('PLACE_OPENINGS')).toBe('DONE');
    expect(state.get('DEFINE_LEVELS')).toBe('DONE');
    expect(state.get('DRAW_ELECTRICAL')).toBe('DONE');
  });

  it('proposes exactly one next step, and only as a proposal', () => {
    const entries = workflowEntries(empty);
    expect(entries.filter(({ state }) => state === 'CURRENT')).toHaveLength(1);
    // Nothing is refused: every applicable step still carries its action.
    for (const entry of entries)
      if (entry.state !== 'NOT_APPLICABLE')
        expect(entry.actions.length).toBeGreaterThan(0);
  });

  it('shortens itself on a project that does not do a trade', () => {
    const narrow: Project = {
      ...empty,
      scope: { intent: 'STUDY', enabledDomains: ['ARCHITECTURE'] },
    };
    const notApplicable = workflowEntries(narrow).filter(
      ({ state }) => state === 'NOT_APPLICABLE',
    );
    expect(notApplicable.map(({ id }) => id)).toContain('PLACE_SOLAR');
    expect(notApplicable.map(({ id }) => id)).toContain('DRAW_ELECTRICAL');
    // « Hors périmètre » is neither a failure nor a success, and it is not
    // counted as work.
    expect(workflowProgress(narrow).applicable).toBeLessThan(
      WORKFLOW_STEP_IDS.length,
    );
  });

  it('waits on what a step reads rather than forbidding it', () => {
    const entries = workflowEntries(empty);
    const sheets = entries.find(({ id }) => id === 'COMPOSE_SHEETS');
    expect(sheets?.state).toBe('BLOCKED');
    // Blocked still offers the way there: the guide never stops anyone.
    expect(sheets?.actions.length).toBeGreaterThan(0);
  });

  it('keeps the phases out of the navigation', () => {
    for (const group of WORKFLOW_GROUPS)
      expect(
        WORKFLOW_STEP_IDS.filter(
          (id) => WORKFLOW_STEP_BY_ID[id].group === group,
        ).length,
      ).toBeGreaterThan(0);
    expect(WORKFLOW_GROUPS).toHaveLength(10);
  });

  it('counts progress over the steps that concern the project', () => {
    const progress = workflowProgress(house);
    expect(progress.applicable).toBeGreaterThan(0);
    expect(progress.done).toBeLessThanOrEqual(progress.applicable);
    expect(workflowProgress(empty).done).toBe(0);
  });
});
