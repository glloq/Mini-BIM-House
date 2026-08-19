import type { ProjectFile } from '@house-technical-designer/core-domain';
import {
  DEFAULT_PROJECT_MIGRATIONS,
  runMigrationChain,
  type MigrationJournalEntry,
  type ProjectMigration,
} from './migrations.js';

export const CURRENT_PROJECT_SCHEMA_VERSION = '1.0.0';

export interface ProjectValidationIssue {
  readonly path: string;
  readonly message: string;
}
export type ProjectLoadResult =
  | {
      readonly status: 'OK';
      readonly file: ProjectFile;
      readonly migrationJournal: readonly MigrationJournalEntry[];
    }
  | { readonly status: 'INVALID_JSON'; readonly message: string }
  | {
      readonly status: 'INVALID_PROJECT';
      readonly issues: readonly ProjectValidationIssue[];
    }
  | {
      readonly status: 'UNSUPPORTED_FUTURE_SCHEMA';
      readonly schemaVersion: string;
    }
  | { readonly status: 'MIGRATION_ERROR'; readonly message: string };

export function loadProjectJson(
  source: string,
  migrations: readonly ProjectMigration[] = DEFAULT_PROJECT_MIGRATIONS,
): ProjectLoadResult {
  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch (error: unknown) {
    return {
      status: 'INVALID_JSON',
      message: error instanceof Error ? error.message : 'Invalid JSON.',
    };
  }
  if (!isRecord(value) || typeof value.schemaVersion !== 'string') {
    const issues = validateProjectFile(value);
    return { status: 'INVALID_PROJECT', issues };
  }
  if (!/^\d+\.\d+\.\d+$/u.test(value.schemaVersion)) {
    return {
      status: 'INVALID_PROJECT',
      issues: [
        { path: '/schemaVersion', message: 'must be semantic version x.y.z' },
      ],
    };
  }
  if (compareSemver(value.schemaVersion, CURRENT_PROJECT_SCHEMA_VERSION) > 0) {
    return {
      status: 'UNSUPPORTED_FUTURE_SCHEMA',
      schemaVersion: value.schemaVersion,
    };
  }
  let migrationJournal: readonly MigrationJournalEntry[] = [];
  if (value.schemaVersion !== CURRENT_PROJECT_SCHEMA_VERSION) {
    const migrated = runMigrationChain(
      value,
      CURRENT_PROJECT_SCHEMA_VERSION,
      migrations,
    );
    if (migrated.status !== 'OK') {
      return {
        status: 'MIGRATION_ERROR',
        message:
          migrated.status === 'MIGRATION_NOT_FOUND'
            ? `No migration path from ${migrated.from} to ${migrated.target}.`
            : `${migrated.migrationId}: ${migrated.message}`,
      };
    }
    value = migrated.value;
    migrationJournal = migrated.journal;
  }
  const issues = validateProjectFile(value);
  if (issues.length > 0) return { status: 'INVALID_PROJECT', issues };
  const file = value as ProjectFile;
  return { status: 'OK', file: structuredClone(file), migrationJournal };
}

/** Mirrors the current project.schema.json contract without silently defaulting missing data. */
export function validateProjectFile(
  value: unknown,
): readonly ProjectValidationIssue[] {
  const issues: ProjectValidationIssue[] = [];
  if (!isRecord(value)) return [{ path: '/', message: 'must be an object' }];
  requiredString(issues, value, 'format', '/format');
  if (value.format !== 'house-technical-designer-project')
    issues.push({
      path: '/format',
      message: 'must identify a House Technical Designer project',
    });
  requiredString(issues, value, 'schemaVersion', '/schemaVersion');
  if (
    typeof value.schemaVersion === 'string' &&
    !/^\d+\.\d+\.\d+$/u.test(value.schemaVersion)
  )
    issues.push({
      path: '/schemaVersion',
      message: 'must be semantic version x.y.z',
    });
  if (!isRecord(value.project))
    return [...issues, { path: '/project', message: 'must be an object' }];
  const project = value.project;
  requiredString(issues, project, 'id', '/project/id');
  validateMetadata(issues, project.metadata);
  if (!isRecord(project.site))
    issues.push({ path: '/project/site', message: 'must be an object' });
  else
    finiteNumber(
      issues,
      project.site,
      'northAngleDeg',
      '/project/site/northAngleDeg',
    );
  validateBuilding(issues, project.building);
  validateJsonValue(value, '/', issues);
  return issues;
}

export function serializeProjectFile(file: unknown, indentation = 2): string {
  const issues = validateProjectFile(file);
  if (issues.length > 0) throw new ProjectSerializationError(issues);
  const validatedFile = file as ProjectFile;
  if (validatedFile.schemaVersion !== CURRENT_PROJECT_SCHEMA_VERSION)
    throw new RangeError(
      `Cannot save schema version ${validatedFile.schemaVersion}.`,
    );
  if (!Number.isInteger(indentation) || indentation < 0 || indentation > 10)
    throw new RangeError('Indentation must be an integer from 0 to 10.');
  return `${JSON.stringify(canonicalize(validatedFile), null, indentation)}\n`;
}

export class ProjectSerializationError extends Error {
  constructor(readonly issues: readonly ProjectValidationIssue[]) {
    super(issues.map(({ path, message }) => `${path}: ${message}`).join('; '));
    this.name = 'ProjectSerializationError';
  }
}

function validateMetadata(
  issues: ProjectValidationIssue[],
  value: unknown,
): void {
  if (!isRecord(value)) {
    issues.push({ path: '/project/metadata', message: 'must be an object' });
    return;
  }
  requiredString(issues, value, 'name', '/project/metadata/name');
  requiredString(issues, value, 'createdAt', '/project/metadata/createdAt');
  requiredString(issues, value, 'updatedAt', '/project/metadata/updatedAt');
}

function validateBuilding(
  issues: ProjectValidationIssue[],
  value: unknown,
): void {
  if (!isRecord(value)) {
    issues.push({ path: '/project/building', message: 'must be an object' });
    return;
  }
  if (!Array.isArray(value.levels))
    issues.push({
      path: '/project/building/levels',
      message: 'must be an array',
    });
  else
    value.levels.forEach((level, index) => validateLevel(issues, level, index));
  if (!Array.isArray(value.zones))
    issues.push({
      path: '/project/building/zones',
      message: 'must be an array',
    });
}

function validateLevel(
  issues: ProjectValidationIssue[],
  value: unknown,
  index: number,
): void {
  const base = `/project/building/levels/${index}`;
  if (!isRecord(value)) {
    issues.push({ path: base, message: 'must be an object' });
    return;
  }
  requiredString(issues, value, 'id', `${base}/id`);
  requiredString(issues, value, 'name', `${base}/name`);
  finiteNumber(issues, value, 'elevationMm', `${base}/elevationMm`);
  finiteNumber(
    issues,
    value,
    'defaultStoreyHeightMm',
    `${base}/defaultStoreyHeightMm`,
  );
  if (
    typeof value.defaultStoreyHeightMm === 'number' &&
    value.defaultStoreyHeightMm <= 0
  )
    issues.push({
      path: `${base}/defaultStoreyHeightMm`,
      message: 'must be greater than zero',
    });
}

function requiredString(
  issues: ProjectValidationIssue[],
  value: Record<string, unknown>,
  key: string,
  path: string,
): void {
  const field = value[key];
  if (typeof field !== 'string')
    issues.push({ path, message: 'must be a string' });
  else if (field.length === 0 && key === 'id')
    issues.push({ path, message: 'must not be empty' });
}

function finiteNumber(
  issues: ProjectValidationIssue[],
  value: Record<string, unknown>,
  key: string,
  path: string,
): void {
  if (typeof value[key] !== 'number' || !Number.isFinite(value[key]))
    issues.push({ path, message: 'must be a finite number' });
}

function validateJsonValue(
  value: unknown,
  path: string,
  issues: ProjectValidationIssue[],
): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      issues.push({ path, message: 'must not contain NaN or Infinity' });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      validateJsonValue(item, `${path}/${index}`, issues),
    );
    return;
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value))
      validateJsonValue(item, `${path}/${escapePointer(key)}`, issues);
    return;
  }
  issues.push({ path, message: 'must contain only JSON values' });
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value))
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  return value;
}

function compareSemver(first: string, second: string): number {
  const left = first.split('.').map(Number);
  const right = second.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = left[index]! - right[index]!;
    if (difference !== 0) return difference;
  }
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapePointer(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}
