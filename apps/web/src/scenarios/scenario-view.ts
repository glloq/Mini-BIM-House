import type { Project } from '@house-technical-designer/core-domain';
import {
  projectEntities,
  resolveProjectPath,
  SCENARIO_DIFFABLE,
} from '@house-technical-designer/core-domain';
import type { InspectorEdit } from '../editor/inspector-edits.js';
import { inspectObject, scenarioPathFor } from '../editor/object-editors.js';
import type { AnalysisOverlay } from '@house-technical-designer/calculation-core';
import {
  buildingScenarioTargets,
  type ScenarioTarget,
} from './scenario-paths.js';

/**
 * The property of an object a scenario can vary, found from the plan.
 *
 * Choosing what to vary used to mean picking a path out of a list of every
 * value in the project. Pointing at a wall and changing its assembly says the
 * same thing and asks nothing: the path is derived from what was pointed at.
 *
 * And it is derived for every property, not for the four that had been written
 * down. The list of variable paths held walls, assembly layers and equipment,
 * so pointing at a stair and changing its going was answered with « ne peut pas
 * encore varier » — the property was editable, comparable and simply not
 * reachable. A family says where its objects live, a property says what it is
 * called there, and what a variant may change is what the inspector shows.
 *
 * A property whose path addresses nothing is refused: the wall length and the
 * wall angle are read off the geometry rather than stored, and a scenario
 * setting `walls/x/lengthMm` would write a field nothing reads.
 */
export function targetForEdit(
  project: Project,
  objectId: string,
  edit: InspectorEdit,
): ScenarioTarget | undefined {
  const path = scenarioPathFor(project, objectId, edit);
  if (path === undefined) return undefined;
  const current = resolveProjectPath(project, path);
  if (typeof current !== 'number' && typeof current !== 'string')
    return undefined;
  const named = buildingScenarioTargets(project).find(
    (target) => target.path === path,
  );
  if (named !== undefined) return named;
  const { control } = edit;
  return {
    path,
    label: `${inspectObject(project, objectId).title} — ${edit.label}`,
    group: 'Depuis le plan',
    currentValue: String(current),
    numeric: control.kind === 'NUMBER',
    ...(control.kind === 'NUMBER' && control.unit !== undefined
      ? { unit: control.unit }
      : {}),
    ...(control.kind === 'SELECT' ? { options: control.options } : {}),
  };
}

/** What a variant does to one object, compared with the project it varies. */
export type ScenarioChangeKind = 'ADDED' | 'REMOVED' | 'CHANGED';

export interface ScenarioObjectDiff {
  readonly objectId: string;
  readonly kind: ScenarioChangeKind;
}

/**
 * Everything a scenario could touch, by identifier.
 *
 * Read from the project's own index rather than from a list written here. The
 * list written here had already fallen behind: a variant moving a post,
 * planting a tree or adding a note showed nothing at all, because those three
 * families were never enumerated. Which families count is a table with a test
 * behind it, so a family added to the model cannot slip past.
 */
function objectsOf(project: Project): ReadonlyMap<string, string> {
  const entities = projectEntities(project);
  // What each object is on its own. A storey holds its walls, so comparing a
  // storey whole would report it as changed every time one of its walls moved
  // — one change shown twice, and the second one pointing at a thing nobody
  // touched. What a storey *is* — its name, its height above the ground — is
  // still compared, because that is the storey and not its contents.
  const held = new Set(
    entities
      .filter(({ scope }) => scope === 'GLOBAL')
      .map(({ id }) => id as unknown),
  );
  const signatures = new Map<string, string>();
  for (const entity of entities)
    if (SCENARIO_DIFFABLE[entity.family])
      signatures.set(
        entity.id,
        JSON.stringify(withoutChildren(entity.value, held)),
      );
  return signatures;
}

/** The value with the objects the index already compares taken out of it. */
function withoutChildren(value: unknown, held: ReadonlySet<unknown>): unknown {
  if (Array.isArray(value))
    return value
      .filter(
        (item) =>
          item === null ||
          typeof item !== 'object' ||
          !held.has((item as { readonly id?: unknown }).id),
      )
      .map((item) => withoutChildren(item, held));
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, held_]) => [
        key,
        withoutChildren(held_, held),
      ]),
    );
  return value;
}

/**
 * What a variant adds, removes and changes, object by object.
 *
 * Comparing the two projects rather than reading the list of overrides: an
 * override on an assembly changes every wall built of it, and a list of paths
 * would show one change where the drawing shows twelve.
 */
export function scenarioDiff(
  base: Project,
  variant: Project,
): readonly ScenarioObjectDiff[] {
  const before = objectsOf(base);
  const after = objectsOf(variant);
  const diffs: ScenarioObjectDiff[] = [];
  for (const [objectId, signature] of after) {
    const previous = before.get(objectId);
    if (previous === undefined) diffs.push({ objectId, kind: 'ADDED' });
    else if (previous !== signature) diffs.push({ objectId, kind: 'CHANGED' });
  }
  for (const objectId of before.keys())
    if (!after.has(objectId)) diffs.push({ objectId, kind: 'REMOVED' });
  return diffs;
}

const DIFF_VALUES: Readonly<Record<ScenarioChangeKind, number>> = {
  REMOVED: 0,
  CHANGED: 1,
  ADDED: 2,
};

/**
 * The difference, drawn on the plan like any other analysis.
 *
 * A variant read as a table of paths is a variant nobody can picture. The same
 * three bands the analyses already use carry it: removed, changed, added.
 */
export function scenarioDiffOverlay(
  diffs: readonly ScenarioObjectDiff[],
): AnalysisOverlay | undefined {
  if (diffs.length === 0) return undefined;
  return {
    id: 'scenario-diff',
    metric: 'SCENARIO_DIFF',
    unit: '—',
    values: Object.fromEntries(
      diffs.map(({ objectId, kind }) => [objectId, DIFF_VALUES[kind]]),
    ),
    scale: { kind: 'CONTINUOUS', minimum: 0, maximum: 2, clamp: true },
  };
}
