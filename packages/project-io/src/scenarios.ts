import type {
  Project,
  Scenario,
  ScenarioOverride,
} from '@house-technical-designer/core-domain';
import {
  childAt,
  elementIndex,
  parseProjectPath,
} from '@house-technical-designer/core-domain';
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  validateProjectReferences,
} from './project-io.js';

export type ScenarioIssueCode =
  | 'SCENARIO_UNKNOWN_ID'
  | 'SCENARIO_INVALID_PATH'
  | 'SCENARIO_PATH_NOT_FOUND'
  | 'SCENARIO_MISSING_VALUE'
  | 'SCENARIO_REVISION_MISMATCH'
  | 'SCENARIO_BROKEN_REFERENCE';

export interface ScenarioIssue {
  readonly code: ScenarioIssueCode;
  readonly path: string;
  readonly message: string;
}

export type ScenarioApplicationResult =
  | {
      readonly status: 'OK';
      readonly project: Project;
      readonly issues: readonly ScenarioIssue[];
    }
  | { readonly status: 'INVALID'; readonly issues: readonly ScenarioIssue[] };

type MutableJson = Record<string, unknown> | unknown[];

/**
 * Splits a `/`-separated override path. Leading slashes are tolerated so both
 * `site/altitudeM` and `/site/altitudeM` address the same node.
 */
function parsePath(path: string): readonly string[] | undefined {
  const segments = parseProjectPath(path);
  return segments.length === 0 ? undefined : segments;
}

/**
 * Resolves the parent container of a path, creating nothing along the way:
 * a scenario may only override facts the project actually declares.
 */
function resolveParent(
  root: MutableJson,
  segments: readonly string[],
): MutableJson | undefined {
  let current: MutableJson = root;
  for (const segment of segments.slice(0, -1)) {
    const child = childAt(current, segment);
    if (typeof child !== 'object' || child === null) return undefined;
    current = child as MutableJson;
  }
  return current;
}

function readAt(parent: MutableJson, segment: string): unknown {
  return childAt(parent, segment);
}

function writeAt(parent: MutableJson, segment: string, value: unknown): void {
  if (Array.isArray(parent)) {
    const index = elementIndex(parent, segment);
    if (index !== undefined) parent[index] = value;
    return;
  }
  parent[segment] = value;
}

function removeAt(parent: MutableJson, segment: string): void {
  if (Array.isArray(parent)) {
    const index = elementIndex(parent, segment);
    if (index !== undefined) parent.splice(index, 1);
    return;
  }
  delete parent[segment];
}

function applyOverride(
  root: MutableJson,
  override: ScenarioOverride,
  issues: ScenarioIssue[],
): void {
  const segments = parsePath(override.path);
  if (segments === undefined) {
    issues.push({
      code: 'SCENARIO_INVALID_PATH',
      path: override.path,
      message: 'Override path must address at least one project node.',
    });
    return;
  }
  const parent = resolveParent(root, segments);
  const leaf = segments[segments.length - 1]!;
  if (parent === undefined) {
    issues.push({
      code: 'SCENARIO_PATH_NOT_FOUND',
      path: override.path,
      message: `Project does not contain ${segments.slice(0, -1).join('/')}.`,
    });
    return;
  }
  const needsValue =
    override.operation === 'SET' ||
    override.operation === 'ADD' ||
    override.operation === 'REPLACE_REFERENCE';
  if (needsValue && override.value === undefined) {
    issues.push({
      code: 'SCENARIO_MISSING_VALUE',
      path: override.path,
      message: `Operation ${override.operation} requires a value.`,
    });
    return;
  }
  switch (override.operation) {
    case 'SET':
      writeAt(parent, leaf, override.value);
      return;
    case 'REMOVE':
      if (readAt(parent, leaf) === undefined) {
        issues.push({
          code: 'SCENARIO_PATH_NOT_FOUND',
          path: override.path,
          message: 'Nothing to remove at this path.',
        });
        return;
      }
      removeAt(parent, leaf);
      return;
    case 'ADD': {
      const target = readAt(parent, leaf);
      if (!Array.isArray(target)) {
        issues.push({
          code: 'SCENARIO_PATH_NOT_FOUND',
          path: override.path,
          message: 'ADD requires an existing array at this path.',
        });
        return;
      }
      target.push(override.value);
      return;
    }
    case 'REPLACE_REFERENCE': {
      const current = readAt(parent, leaf);
      if (typeof current !== 'string') {
        issues.push({
          code: 'SCENARIO_PATH_NOT_FOUND',
          path: override.path,
          message: 'REPLACE_REFERENCE requires an existing string reference.',
        });
        return;
      }
      writeAt(parent, leaf, override.value);
      return;
    }
    default:
      issues.push({
        code: 'SCENARIO_INVALID_PATH',
        path: override.path,
        message: 'Unsupported scenario operation.',
      });
  }
}

/**
 * Produces the project variant described by a scenario.
 *
 * The base project is never mutated, and the variant is derived on demand rather
 * than persisted: scenarios stay a list of overrides in the project file.
 */
export function applyScenario(
  project: Project,
  scenario: Scenario,
): ScenarioApplicationResult {
  const issues: ScenarioIssue[] = [];
  if (
    project.metadata.projectRevision !== undefined &&
    scenario.baseProjectRevision !== '' &&
    scenario.baseProjectRevision !== project.metadata.projectRevision
  ) {
    issues.push({
      code: 'SCENARIO_REVISION_MISMATCH',
      path: `scenarios/${scenario.id}`,
      message: `Scenario targets revision ${scenario.baseProjectRevision} but the project is at ${project.metadata.projectRevision}.`,
    });
  }
  const draft: MutableJson = structuredClone(project) as unknown as Record<
    string,
    unknown
  >;
  for (const override of scenario.overrides)
    applyOverride(draft, override, issues);
  const variant = draft as unknown as Project;
  // A scenario answers for what it breaks, not for what the project already
  // carried: only the references its own changes made dangle are reported.
  for (const broken of referencesBrokenBy(project, variant))
    issues.push({
      code: 'SCENARIO_BROKEN_REFERENCE',
      path: broken.path,
      message: `Le scénario ${scenario.id} rend une référence invalide : ${broken.path} ${broken.message}.`,
    });
  if (issues.some(({ code }) => code !== 'SCENARIO_REVISION_MISMATCH'))
    return { status: 'INVALID', issues };
  return { status: 'OK', project: variant, issues };
}

function asFile(project: Project) {
  return {
    format: 'house-technical-designer-project' as const,
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    project,
  };
}

/** Reference problems the variant has and the base project did not. */
function referencesBrokenBy(
  project: Project,
  variant: Project,
): readonly { readonly path: string; readonly message: string }[] {
  const before = new Set(
    validateProjectReferences(asFile(project)).map(
      ({ path, message }) => `${path} ${message}`,
    ),
  );
  return validateProjectReferences(asFile(variant)).filter(
    ({ path, message }) => !before.has(`${path} ${message}`),
  );
}

/** Applies the scenario carried by the project under the given identifier. */
export function applyProjectScenario(
  project: Project,
  scenarioId: string,
): ScenarioApplicationResult {
  const scenario = project.scenarios?.find(({ id }) => id === scenarioId);
  if (scenario === undefined)
    return {
      status: 'INVALID',
      issues: [
        {
          code: 'SCENARIO_UNKNOWN_ID',
          path: `scenarios/${scenarioId}`,
          message: `Project has no scenario ${scenarioId}.`,
        },
      ],
    };
  return applyScenario(project, scenario);
}

/** Lists the scenario variants a project can be calculated under. */
export function listScenarios(project: Project): readonly Scenario[] {
  return project.scenarios ?? [];
}
