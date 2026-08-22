/**
 * What each step of the guide measures, and where it sends someone.
 *
 * Every answer is read from the project, every time it is asked for. Nothing
 * here writes: a `stepCompleted` flag would say that somebody clicked, and
 * what matters is whether the house actually has its walls. A project that
 * loses its walls has to lose the step with them.
 *
 * The guide recommends. It never refuses an action, never greys one out and
 * never puts a step in anyone's way: a person who wants to draw the electrics
 * before naming the rooms is right about their own project.
 */
import {
  domainEnabled,
  projectScopeOf,
  resolvedSpaces,
  type Project,
  type ProjectScope,
} from '@house-technical-designer/core-domain';

import { technicalDomains } from '../systems/discipline-scope.js';
import type { UiTarget } from '../ux/ui-target.js';
import {
  WORKFLOW_STEP_BY_ID,
  WORKFLOW_STEP_IDS,
  type WorkflowAction,
  type WorkflowStepDescriptor,
  type WorkflowStepId,
  type WorkflowStepState,
} from '../ux/workflow-steps.js';
import { workspaceOfDomain } from '../ux/workspaces.js';

const levels = (project: Project) => project.building.levels;
const every = <T>(
  project: Project,
  read: (level: Project['building']['levels'][number]) => readonly T[],
): readonly T[] => levels(project).flatMap((level) => read(level));

/** Where a step's work is done, derived from the trade it belongs to. */
function targetOf(id: WorkflowStepId): UiTarget {
  const definition = WORKFLOW_STEP_BY_ID[id];
  const domain = definition.domain;
  if (domain === undefined)
    return {
      workspace: definition.group === 'DOCUMENTS' ? 'DOCUMENTS' : 'PROJECT',
    };
  const workspace = workspaceOfDomain(domain);
  return workspace === 'SYSTEMS' ? { workspace, domain } : { workspace };
}

function go(id: WorkflowStepId, label: string): readonly WorkflowAction[] {
  return [{ label, target: targetOf(id) }];
}

/**
 * What each step reads.
 *
 * `DONE` means the project holds the thing, not that anybody said so.
 * `AVAILABLE` means there is nothing stopping it. `BLOCKED` says a step reads
 * something that has not happened yet — and it still never stops anyone.
 */
type Measure = (project: Project) => boolean;

const MEASURES: Readonly<Record<WorkflowStepId, Measure>> = {
  NAME_PROJECT: (project) =>
    project.metadata.name.trim() !== '' &&
    project.metadata.name.trim() !== 'Nouveau projet',
  CHOOSE_INTENT: (project) => project.scope !== undefined,
  CHOOSE_SCOPE: (project) => project.scope !== undefined,
  LOCATE_SITE: (project) => project.site.location !== undefined,
  ORIENT_NORTH: (project) => project.site.northAngleDeg !== 0,
  DRAW_PARCEL: (project) => project.site.parcelBoundary !== undefined,
  PICK_CLIMATE: (project) => project.site.climateProfileId !== undefined,
  DEFINE_LEVELS: (project) => levels(project).length > 1,
  SET_LEVEL_HEIGHTS: (project) =>
    new Set(levels(project).map((level) => level.defaultStoreyHeightMm)).size >
    1,
  DRAW_EXTERIOR_WALLS: (project) =>
    every(project, (level) => level.walls).some(
      ({ role }) => role === 'EXTERIOR',
    ),
  DRAW_PARTITIONS: (project) =>
    every(project, (level) => level.walls).some(
      ({ role }) => role === 'INTERIOR' || role === 'PARTITION',
    ),
  NAME_SPACES: (project) => every(project, (level) => level.spaces).length > 0,
  PLACE_OPENINGS: (project) =>
    every(project, (level) => level.openings).length > 0,
  PLACE_STAIRS: (project) => every(project, (level) => level.stairs).length > 0,
  ASSIGN_WALL_ASSEMBLIES: (project) =>
    every(project, (level) => level.walls).every(
      ({ assemblyId }) => assemblyId !== undefined,
    ) && every(project, (level) => level.walls).length > 0,
  ASSIGN_SLAB_ASSEMBLIES: (project) =>
    every(project, (level) => level.slabs).length > 0,
  DRAW_ROOF: (project) =>
    every(project, (level) => level.roofs).length > 0 ||
    every(project, (level) => level.roofStructures ?? []).length > 0,
  PLACE_STRUCTURE: (project) =>
    every(project, (level) => level.structure ?? []).length > 0,
  PLACE_FURNITURE: (project) =>
    every(project, (level) => level.components ?? []).some(
      ({ category }) => category === 'FURNITURE',
    ),
  DRAW_WATER: (project) => holdsDiscipline(project, 'WATER'),
  DRAW_WASTEWATER: (project) => holdsDiscipline(project, 'WASTEWATER'),
  DRAW_RAINWATER: (project) => holdsDiscipline(project, 'RAINWATER'),
  DRAW_HEATING: (project) => holdsDiscipline(project, 'HEATING'),
  DRAW_VENTILATION: (project) => holdsDiscipline(project, 'VENTILATION'),
  DRAW_ELECTRICAL: (project) => holdsDiscipline(project, 'ELECTRICAL'),
  PLACE_LIGHTING: (project) =>
    every(project, (level) => level.components ?? []).some(
      ({ category }) => category === 'LIGHTING',
    ),
  RUN_THERMAL: (project) =>
    project.calculationSettings?.['thermal'] !== undefined,
  PLACE_SOLAR: (project) =>
    every(project, (level) => level.components ?? []).some(
      ({ category }) => category === 'PHOTOVOLTAIC',
    ),
  RUN_ENERGY_BALANCE: (project) =>
    project.calculationSettings?.['energy-balance'] !== undefined,
  // A finding is only resolved by there being none left, which the check
  // screen answers and this cannot: the step reads as available until then.
  RESOLVE_ISSUES: () => false,
  RUN_RULE_PACKS: (project) =>
    (project.regulatoryContext?.enabledRulePacks ?? []).length > 0,
  SAVE_VIEWS: (project) => (project.drawingViews ?? []).length > 0,
  COMPOSE_SHEETS: (project) => (project.sheets ?? []).length > 0,
  // Exporting leaves no trace in the project, and inventing one would be a
  // derived fact persisted — the thing this application refuses everywhere
  // else. The step stays available, which is the truth about it.
  EXPORT: () => false,
};

function holdsDiscipline(project: Project, discipline: string): boolean {
  return (project.systems ?? []).some(
    (network) =>
      network.discipline === discipline &&
      (network.nodes.length > 0 || network.edges.length > 0),
  );
}

/** Whether this step concerns this project at all. */
function appliesTo(
  id: WorkflowStepId,
  project: Project,
  scope: ProjectScope,
): boolean {
  const domain = WORKFLOW_STEP_BY_ID[id].domain;
  if (domain === undefined) return true;
  if (workspaceOfDomain(domain) === 'SYSTEMS')
    return technicalDomains(project).includes(domain);
  return domainEnabled(scope, domain);
}

export const WORKFLOW_REGISTRY: Readonly<
  Record<WorkflowStepId, WorkflowStepDescriptor>
> = Object.fromEntries(
  WORKFLOW_STEP_IDS.map((id) => [
    id,
    {
      id,
      applies: (project: Project, scope: ProjectScope) =>
        appliesTo(id, project, scope),
      evaluate: (project: Project) =>
        MEASURES[id](project) ? 'DONE' : 'AVAILABLE',
      actions: () => go(id, WORKFLOW_STEP_BY_ID[id].label),
    } satisfies WorkflowStepDescriptor,
  ]),
) as unknown as Readonly<Record<WorkflowStepId, WorkflowStepDescriptor>>;

export interface WorkflowEntry {
  readonly id: WorkflowStepId;
  readonly label: string;
  readonly group: (typeof WORKFLOW_STEP_BY_ID)[WorkflowStepId]['group'];
  readonly state: WorkflowStepState;
  readonly actions: readonly WorkflowAction[];
}

/**
 * The guide, read from the project.
 *
 * One step is `CURRENT` — the first that is not done and not waiting on
 * another — and it is a suggestion, not a gate. A step whose prerequisites are
 * not met reads as `BLOCKED`, which says why it is further down the list and
 * nothing more: it can still be done today.
 */
export function workflowEntries(project: Project): readonly WorkflowEntry[] {
  const scope = projectScopeOf(project);
  const done = new Set<WorkflowStepId>();
  const applicable: WorkflowStepId[] = [];
  for (const id of WORKFLOW_STEP_IDS) {
    if (!WORKFLOW_REGISTRY[id].applies(project, scope)) continue;
    applicable.push(id);
    if (WORKFLOW_REGISTRY[id].evaluate(project) === 'DONE') done.add(id);
  }
  let current: WorkflowStepId | undefined;
  const entries: WorkflowEntry[] = [];
  for (const id of WORKFLOW_STEP_IDS) {
    const definition = WORKFLOW_STEP_BY_ID[id];
    if (!applicable.includes(id)) {
      entries.push({
        id,
        label: definition.label,
        group: definition.group,
        state: 'NOT_APPLICABLE',
        actions: [],
      });
      continue;
    }
    const waiting = (definition.after ?? []).some(
      (previous) => !done.has(previous as WorkflowStepId),
    );
    let state: WorkflowStepState = done.has(id)
      ? 'DONE'
      : waiting
        ? 'BLOCKED'
        : 'AVAILABLE';
    if (state === 'AVAILABLE' && current === undefined) {
      current = id;
      state = 'CURRENT';
    }
    entries.push({
      id,
      label: definition.label,
      group: definition.group,
      state,
      actions: WORKFLOW_REGISTRY[id].actions(project),
    });
  }
  return entries;
}

/** How far a project has got, counting only the steps that concern it. */
export function workflowProgress(project: Project): {
  readonly done: number;
  readonly applicable: number;
} {
  const entries = workflowEntries(project).filter(
    ({ state }) => state !== 'NOT_APPLICABLE',
  );
  return {
    done: entries.filter(({ state }) => state === 'DONE').length,
    applicable: entries.length,
  };
}

/** Rooms whose surface the model cannot work out; used by the guide's hints. */
export function unresolvedRooms(project: Project): number {
  return resolvedSpaces(project).filter(
    ({ unresolved }) => unresolved !== undefined,
  ).length;
}
