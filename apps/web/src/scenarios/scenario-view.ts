import type { Project } from '@house-technical-designer/core-domain';
import type { AnalysisOverlay } from '@house-technical-designer/calculation-core';
import { scenarioTargets, type ScenarioTarget } from './scenario-changes.js';

/**
 * The property of an object a scenario can vary, found from the plan.
 *
 * Choosing what to vary used to mean picking a path out of a list of every
 * value in the project. Pointing at a wall and changing its assembly says the
 * same thing and asks nothing: the path is derived from what was pointed at.
 */
export function targetForEdit(
  project: Project,
  objectId: string,
  editId: string,
): ScenarioTarget | undefined {
  return scenarioTargets(project).find(
    ({ path }) => path.includes(`/${objectId}/`) && path.endsWith(`/${editId}`),
  );
}

/** What a variant does to one object, compared with the project it varies. */
export type ScenarioChangeKind = 'ADDED' | 'REMOVED' | 'CHANGED';

export interface ScenarioObjectDiff {
  readonly objectId: string;
  readonly kind: ScenarioChangeKind;
}

/** Everything of a storey a scenario could touch, by identifier. */
function objectsOf(project: Project): ReadonlyMap<string, string> {
  const signatures = new Map<string, string>();
  for (const level of project.building.levels) {
    for (const wall of level.walls)
      signatures.set(wall.id, JSON.stringify(wall));
    for (const opening of level.openings)
      signatures.set(opening.id, JSON.stringify(opening));
    for (const slab of level.slabs)
      signatures.set(slab.id, JSON.stringify(slab));
    for (const roof of level.roofs)
      signatures.set(roof.id, JSON.stringify(roof));
    for (const space of level.spaces)
      signatures.set(space.id, JSON.stringify(space));
    for (const stair of level.stairs)
      signatures.set(stair.id, JSON.stringify(stair));
    for (const component of level.components ?? [])
      signatures.set(component.id, JSON.stringify(component));
    for (const roof of level.roofStructures ?? [])
      signatures.set(roof.id, JSON.stringify(roof));
  }
  for (const network of project.systems ?? []) {
    for (const node of network.nodes)
      signatures.set(node.id, JSON.stringify(node));
    for (const edge of network.edges)
      signatures.set(edge.id, JSON.stringify(edge));
  }
  return signatures;
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
