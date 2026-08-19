export interface ProjectMigration {
  readonly from: string;
  readonly to: string;
  readonly id: string;
  migrate(input: unknown): unknown;
}

export interface MigrationJournalEntry {
  readonly migrationId: string;
  readonly from: string;
  readonly to: string;
}

export type MigrationChainResult =
  | {
      readonly status: 'OK';
      readonly value: unknown;
      readonly journal: readonly MigrationJournalEntry[];
    }
  | {
      readonly status: 'MIGRATION_NOT_FOUND';
      readonly from: string;
      readonly target: string;
    }
  | {
      readonly status: 'MIGRATION_FAILED';
      readonly migrationId: string;
      readonly message: string;
    };

/** Runs pure, sequential migrations against a clone so the caller's source is never mutated. */
export function runMigrationChain(
  input: unknown,
  targetVersion: string,
  migrations: readonly ProjectMigration[],
): MigrationChainResult {
  if (!isRecord(input) || typeof input.schemaVersion !== 'string') {
    return {
      status: 'MIGRATION_NOT_FOUND',
      from: 'UNKNOWN',
      target: targetVersion,
    };
  }
  let current: unknown = structuredClone(input);
  let version = input.schemaVersion;
  const journal: MigrationJournalEntry[] = [];
  const visited = new Set<string>();
  while (version !== targetVersion) {
    if (visited.has(version))
      return {
        status: 'MIGRATION_FAILED',
        migrationId: 'chain',
        message: `Migration cycle at ${version}.`,
      };
    visited.add(version);
    const candidates = migrations.filter(({ from }) => from === version);
    if (candidates.length !== 1)
      return {
        status: 'MIGRATION_NOT_FOUND',
        from: version,
        target: targetVersion,
      };
    const migration = candidates[0]!;
    try {
      const output = migration.migrate(structuredClone(current));
      if (!isRecord(output) || output.schemaVersion !== migration.to) {
        return {
          status: 'MIGRATION_FAILED',
          migrationId: migration.id,
          message: `Migration must output schemaVersion ${migration.to}.`,
        };
      }
      current = structuredClone(output);
      journal.push({
        migrationId: migration.id,
        from: migration.from,
        to: migration.to,
      });
      version = migration.to;
    } catch (error: unknown) {
      return {
        status: 'MIGRATION_FAILED',
        migrationId: migration.id,
        message:
          error instanceof Error ? error.message : 'Unknown migration failure.',
      };
    }
  }
  return { status: 'OK', value: current, journal };
}

/** Artificial pre-1.0 fixture migration: `project.info` became `project.metadata`. */
export const migration090To100: ProjectMigration = {
  id: 'project-0.9.0-to-1.0.0',
  from: '0.9.0',
  to: '1.0.0',
  migrate(input: unknown): unknown {
    if (
      !isRecord(input) ||
      !isRecord(input.project) ||
      !isRecord(input.project.info)
    ) {
      throw new TypeError('0.9.0 project must contain project.info.');
    }
    const { info, ...projectRest } = input.project;
    return {
      ...input,
      schemaVersion: '1.0.0',
      project: { ...projectRest, metadata: info },
    };
  },
};

export const DEFAULT_PROJECT_MIGRATIONS: readonly ProjectMigration[] = [
  migration090To100,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
