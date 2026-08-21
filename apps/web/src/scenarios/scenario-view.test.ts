import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
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
import { populatedProject } from '../test-support/populated-project.js';

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

/** The reference house with a stair on it, and a storey for it to climb to. */
function withStair(): Project {
  const base = project();
  const ground = base.building.levels[0]!;
  return {
    ...base,
    building: {
      ...base.building,
      levels: [
        {
          ...ground,
          stairs: [
            {
              id: 'stair-main' as (typeof ground.stairs)[number]['id'],
              type: 'STAIR',
              levelId: ground.id,
              topLevelId: ground.id,
              stairType: 'STRAIGHT',
              widthMm: 900,
              riserCount: 16,
              treadDepthMm: 270,
              path: {
                points: [
                  { x: 0, y: 0 },
                  { x: 4050, y: 0 },
                ],
              },
            },
          ],
        },
      ],
    },
  };
}

/** The inspector property with this identifier, as the panel would offer it. */
function editOf(source: Project, objectId: string, editId: string) {
  const edit = editsFor(source, objectId).find(({ id }) => id === editId);
  if (edit === undefined) throw new Error(`no edit ${editId}`);
  return edit;
}

describe('varying what was pointed at', () => {
  it('finds the path behind a property of a wall', () => {
    // Choosing what to vary used to mean picking a path out of a list of every
    // value in the project.
    const target = targetForEdit(
      project(),
      'wall-south',
      editOf(project(), 'wall-south', 'assemblyId'),
    )!;
    expect(target.path).toBe(
      'building/levels/ground/walls/wall-south/assemblyId',
    );
    expect(target.currentValue).toBe('assembly-exterior');
  });

  it('says nothing for a property the file does not store', () => {
    // The length and the angle of a wall are read off its two points; a
    // scenario writing `walls/x/lengthMm` would set a field nothing reads.
    expect(
      targetForEdit(
        project(),
        'wall-south',
        editOf(project(), 'wall-south', 'lengthMm'),
      ),
    ).toBeUndefined();
  });

  it('reaches every property the inspector offers, not four of them', () => {
    // Pointing at a stair and changing its going was answered with « ne peut
    // pas encore varier » : the property was editable, comparable, and simply
    // not in the hand-written list of variable paths.
    const source = withStair();
    for (const [objectId, editId, expected] of [
      [
        'stair-main',
        'riserCount',
        'building/levels/ground/stairs/stair-main/riserCount',
      ],
      [
        'wall-south',
        'referenceSide',
        'building/levels/ground/walls/wall-south/referenceSide',
      ],
      [
        'space-living',
        'category',
        'building/levels/ground/spaces/space-living/category',
      ],
      [
        'opening-entry',
        'widthMm',
        'building/levels/ground/openings/opening-entry/widthMm',
      ],
    ] as const) {
      const target = targetForEdit(
        source,
        objectId,
        editOf(source, objectId, editId),
      );
      expect(target?.path, `${objectId}/${editId}`).toBe(expected);
    }
  });

  it('reads a segment’s properties where the file keeps them', () => {
    const source = project();
    const target = targetForEdit(
      source,
      'water:trunk',
      editOf(source, 'water:trunk', 'internalDiameterM'),
    );
    expect(target?.path).toBe(
      'systems/water/edges/water:trunk/properties/internalDiameterM',
    );
  });

  it('turns a property of the plan into a change of the variant', () => {
    const source = withScenario();
    const target = targetForEdit(
      source,
      'wall-south',
      editOf(source, 'wall-south', 'assemblyId'),
    )!;
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
      editOf(dispatcher.project, 'wall-south', 'assemblyId'),
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
    const ids = editsFor(project(), 'wall-south').map(({ id }) => id);
    expect(ids).toContain('assemblyId');
    expect(
      targetForEdit(
        project(),
        'wall-south',
        editOf(project(), 'wall-south', 'assemblyId'),
      ),
    ).toBeDefined();
  });
});

describe('seeing what a variant changes', () => {
  function varied() {
    const dispatcher = new ProjectCommandDispatcher(withScenario());
    const target = targetForEdit(
      dispatcher.project,
      'wall-south',
      editOf(dispatcher.project, 'wall-south', 'assemblyId'),
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

describe('what a variant is compared on', () => {
  it('sees a post moved, a tree planted and a note added', () => {
    // The diff enumerated nine families by hand; a variant touching any of
    // these three showed nothing at all.
    const base = populatedProject();
    const variant: Project = {
      ...base,
      site: { ...base.site, obstacles: [] },
      building: {
        ...base.building,
        levels: base.building.levels.map((level, index) =>
          index === 0
            ? {
                ...level,
                structure: (level.structure ?? []).map((member) => ({
                  ...member,
                  path: [{ x: 9000, y: 9000 }],
                })),
                annotations: [],
              }
            : level,
        ),
      },
    };
    const changed = scenarioDiff(base, variant);
    expect(
      changed.find(({ objectId }) => objectId === 'member-column')?.kind,
    ).toBe('CHANGED');
    expect(
      changed.find(({ objectId }) => objectId === 'obstacle-tree')?.kind,
    ).toBe('REMOVED');
    expect(
      changed.find(({ objectId }) => objectId === 'note-demolition')?.kind,
    ).toBe('REMOVED');
  });

  it('does not report a storey as changed because a wall of it moved', () => {
    // One change shown twice, the second pointing at a thing nobody touched.
    const base = populatedProject();
    const variant: Project = {
      ...base,
      building: {
        ...base.building,
        levels: base.building.levels.map((level, index) =>
          index === 0
            ? {
                ...level,
                walls: level.walls.map((wall) => ({
                  ...wall,
                  heightMm: 3000,
                })),
              }
            : level,
        ),
      },
    };
    const changed = scenarioDiff(base, variant);
    expect(changed.some(({ objectId }) => objectId === 'ground')).toBe(false);
    expect(changed.length).toBeGreaterThan(0);
  });
});
