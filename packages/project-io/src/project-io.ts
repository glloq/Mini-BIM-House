import type { ProjectFile } from '@house-technical-designer/core-domain';
import validateProjectSchema from './generated-project-validator.js';
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

/** Validates with the compiled canonical JSON Schema, then checks project-wide references. */
export function validateProjectFile(
  value: unknown,
): readonly ProjectValidationIssue[] {
  if (!validateProjectSchema(value))
    return (validateProjectSchema.errors ?? []).map((error) => ({
      path:
        error.keyword === 'required' &&
        typeof error.params.missingProperty === 'string'
          ? `${error.instancePath}/${error.params.missingProperty}`
          : error.instancePath === ''
            ? '/'
            : error.instancePath,
      message: error.message ?? 'does not satisfy the project schema',
    }));
  return validateProjectReferences(value as ProjectFile);
}

function validateProjectReferences(
  file: ProjectFile,
): readonly ProjectValidationIssue[] {
  const issues: ProjectValidationIssue[] = [];
  const levels = new Set(file.project.building.levels.map(({ id }) => id));
  const walls = new Set(
    file.project.building.levels.flatMap(({ walls }) =>
      walls.map(({ id }) => id),
    ),
  );
  const materials = new Set(
    file.project.materialLibrary?.materials.map(({ id }) => id) ?? [],
  );
  const assemblies = new Set(
    file.project.assemblies?.map(({ id }) => id) ?? [],
  );
  file.project.building.levels.forEach((level, levelIndex) => {
    const base = `/project/building/levels/${levelIndex}`;
    for (const [collection, elements] of [
      ['walls', level.walls],
      ['slabs', level.slabs],
      ['roofs', level.roofs],
    ] as const)
      elements.forEach((element, index) => {
        if (!levels.has(element.levelId))
          issues.push({
            path: `${base}/${collection}/${index}/levelId`,
            message: `references unknown level ${element.levelId}`,
          });
        if (!assemblies.has(element.assemblyId))
          issues.push({
            path: `${base}/${collection}/${index}/assemblyId`,
            message: `references unknown assembly ${element.assemblyId}`,
          });
      });
    level.openings.forEach((opening, index) => {
      if (!walls.has(opening.hostElementId))
        issues.push({
          path: `${base}/openings/${index}/hostElementId`,
          message: `references unknown wall ${opening.hostElementId}`,
        });
    });
    level.spaces.forEach((space, index) => {
      if (!levels.has(space.levelId))
        issues.push({
          path: `${base}/spaces/${index}/levelId`,
          message: `references unknown level ${space.levelId}`,
        });
    });
  });
  file.project.assemblies?.forEach((assembly, assemblyIndex) =>
    assembly.layers.forEach((layer, layerIndex) => {
      if (!materials.has(layer.materialId))
        issues.push({
          path: `/project/assemblies/${assemblyIndex}/layers/${layerIndex}/materialId`,
          message: `references unknown material ${layer.materialId}`,
        });
    }),
  );
  file.project.systems?.forEach((network, networkIndex) => {
    const nodeIds = new Set(network.nodes.map(({ id }) => id));
    const portIds = new Set(network.ports.map(({ id }) => id));
    network.ports.forEach((port, portIndex) => {
      if (!nodeIds.has(port.nodeId))
        issues.push({
          path: `/project/systems/${networkIndex}/ports/${portIndex}/nodeId`,
          message: `references unknown network node ${port.nodeId}`,
        });
    });
    network.edges.forEach((edge, edgeIndex) => {
      for (const key of ['fromPortId', 'toPortId'] as const)
        if (!portIds.has(edge[key]))
          issues.push({
            path: `/project/systems/${networkIndex}/edges/${edgeIndex}/${key}`,
            message: `references unknown network port ${edge[key]}`,
          });
    });
  });
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
