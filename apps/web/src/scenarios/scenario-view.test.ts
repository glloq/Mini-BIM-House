import { describe, expect, it } from 'vitest';
import {
  ProjectCommandDispatcher,
  SetScenarioOverrideCommand,
} from '@house-technical-designer/editor-core';
import { applyProjectScenario } from '@house-technical-designer/project-io';
import { loadDemoProject } from '../demo-project.js';
import { editsFor } from '../editor/object-editors.js';
import { scenarioOverride } from './scenario-changes.js';
import {
  scenarioDiff,
  scenarioDiffOverlay,
  targetForEdit,
} from './scenario-view.js';

function project() {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file.project;
}

function withScenario() {
  const base = project();
  return {
    ...base,
    scenarios: [
      {
        id: 'variant',
        name: 'Isolation renforcée',
        baseProjectRevision: base.metadata.projectRevision ?? '',
        overrides: [],
      },
    ],
  };
}

describe('varying what was pointed at', () => {
  it('finds the path behind a property of a wall', () => {
    // Choosing what to vary used to mean picking a path out of a list of every
    // value in the project.
    const target = targetForEdit(project(), 'wall-south', 'assemblyId')!;
    expect(target.path).toBe(
      'building/levels/ground/walls/wall-south/assemblyId',
    );
    expect(target.currentValue).toBe('assembly-exterior');
  });

  it('says nothing for a property no scenario path names', () => {
    // Refused out loud rather than silently written into the building.
    expect(
      targetForEdit(project(), 'wall-south', 'referenceSide'),
    ).toBeUndefined();
  });

  it('turns a property of the plan into a change of the variant', () => {
    const source = withScenario();
    const target = targetForEdit(source, 'wall-south', 'assemblyId')!;
    const override = scenarioOverride(target, 'assembly-partition')!;
    const dispatcher = new ProjectCommandDispatcher(source);
    expect(
      dispatcher.dispatch(new SetScenarioOverrideCommand('variant', override))
        .status,
    ).toBe('APPLIED');
    expect(dispatcher.project.scenarios?.[0]?.overrides).toHaveLength(1);
  });

  it('lets the user change their mind about the same property', () => {
    // A variant built by pointing at the plan is built by changing one's mind;
    // having to remove the previous change first would be arithmetic nobody
    // asked to do.
    const dispatcher = new ProjectCommandDispatcher(withScenario());
    const target = targetForEdit(
      dispatcher.project,
      'wall-south',
      'assemblyId',
    )!;
    dispatcher.dispatch(
      new SetScenarioOverrideCommand(
        'variant',
        scenarioOverride(target, 'assembly-partition')!,
      ),
    );
    dispatcher.dispatch(
      new SetScenarioOverrideCommand(
        'variant',
        scenarioOverride(target, 'assembly-exterior')!,
      ),
    );
    expect(dispatcher.project.scenarios?.[0]?.overrides).toHaveLength(1);
    expect(dispatcher.project.scenarios?.[0]?.overrides[0]?.value).toBe(
      'assembly-exterior',
    );
  });

  it('refuses a change to something the project does not declare', () => {
    const dispatcher = new ProjectCommandDispatcher(withScenario());
    expect(
      dispatcher.dispatch(
        new SetScenarioOverrideCommand('variant', {
          path: 'building/levels/ground/walls/nowhere/assemblyId',
          operation: 'SET',
          value: 'assembly-exterior',
        }),
      ).status,
    ).toBe('REJECTED');
  });

  it('offers a scenario path for properties the inspector offers', () => {
    // Not every property can vary yet; the ones that can must be reachable
    // from the plan, which is the whole point of the mode.
    const ids = editsFor(project(), 'wall-south').map(({ id }) => id);
    expect(ids).toContain('assemblyId');
    expect(targetForEdit(project(), 'wall-south', 'assemblyId')).toBeDefined();
  });
});

describe('seeing what a variant changes', () => {
  function varied() {
    const dispatcher = new ProjectCommandDispatcher(withScenario());
    const target = targetForEdit(
      dispatcher.project,
      'wall-south',
      'assemblyId',
    )!;
    dispatcher.dispatch(
      new SetScenarioOverrideCommand(
        'variant',
        scenarioOverride(target, 'assembly-partition')!,
      ),
    );
    const applied = applyProjectScenario(dispatcher.project, 'variant');
    if (applied.status !== 'OK') throw new Error('variant does not apply');
    return { base: dispatcher.project, variant: applied.project };
  }

  it('names the objects the variant changed', () => {
    const { base, variant } = varied();
    const diffs = scenarioDiff(base, variant);
    expect(diffs).toEqual([{ objectId: 'wall-south', kind: 'CHANGED' }]);
  });

  it('says nothing changed when nothing did', () => {
    const base = withScenario();
    expect(scenarioDiff(base, base)).toEqual([]);
    expect(scenarioDiffOverlay([])).toBeUndefined();
  });

  it('draws the difference like any other analysis', () => {
    const { base, variant } = varied();
    const overlay = scenarioDiffOverlay(scenarioDiff(base, variant))!;
    expect(overlay.metric).toBe('SCENARIO_DIFF');
    expect(overlay.values['wall-south']).toBe(1);
  });

  it('reports an object the variant removed', () => {
    const base = withScenario();
    const ground = base.building.levels[0]!;
    const variant = {
      ...base,
      building: {
        ...base.building,
        levels: [
          {
            ...ground,
            walls: ground.walls.filter(({ id }) => id !== 'wall-south'),
          },
        ],
      },
    };
    expect(scenarioDiff(base, variant)).toEqual([
      { objectId: 'wall-south', kind: 'REMOVED' },
    ]);
  });
});
