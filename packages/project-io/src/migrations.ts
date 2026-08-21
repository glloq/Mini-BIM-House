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

/**
 * What a 1.0.0 file could hold that 1.1.0 gives a shape to.
 *
 * Under 1.0.0 the schema accepted `stairs` and `drawingViews` as arrays of
 * anything: they were carried and never read. 1.1.0 gives both a contract, and
 * that is a narrowing — a file the previous version accepted could otherwise
 * be refused by the next one, which is exactly what a schema version exists to
 * prevent.
 *
 * The migration keeps what fits the new contract, and keeps what does not
 * where it can still be recovered: dropping it silently would lose data the
 * user never agreed to lose, and refusing the file would lock them out of
 * their own project.
 */
export const LEGACY_EXTENSION = 'legacy.1-0-0' as const;

function looksLikeStair(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.levelId === 'string' &&
    typeof value.topLevelId === 'string' &&
    typeof value.stairType === 'string' &&
    typeof value.widthMm === 'number' &&
    typeof value.riserCount === 'number' &&
    typeof value.treadDepthMm === 'number' &&
    isRecord(value.path) &&
    Array.isArray(value.path.points) &&
    value.path.points.length >= 2
  );
}

function looksLikeDrawingView(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.name === 'string' &&
    typeof value.scaleDenominator === 'number' &&
    isRecord(value.layers) &&
    typeof value.graphicProfileId === 'string'
  );
}

function partitioned(
  values: readonly unknown[],
  fits: (value: unknown) => boolean,
): { readonly kept: unknown[]; readonly set: unknown[] } {
  const kept: unknown[] = [];
  const set: unknown[] = [];
  for (const value of values) (fits(value) ? kept : set).push(value);
  return { kept, set };
}

export const migration100To110: ProjectMigration = {
  id: 'project-1.0.0-to-1.1.0',
  from: '1.0.0',
  to: '1.1.0',
  migrate(input: unknown): unknown {
    if (!isRecord(input) || !isRecord(input.project))
      throw new TypeError('A 1.0.0 file must contain a project.');
    const project = input.project;
    const building = isRecord(project.building) ? project.building : undefined;
    const levels: readonly unknown[] = Array.isArray(building?.levels)
      ? (building.levels as readonly unknown[])
      : [];
    const setAside: Record<string, unknown> = {};

    const migratedLevels = levels.map((level, index) => {
      if (!isRecord(level)) return level;
      if (!Array.isArray(level.stairs)) return level;
      const { kept, set } = partitioned(
        level.stairs as readonly unknown[],
        looksLikeStair,
      );
      if (set.length > 0) setAside[`building/levels/${index}/stairs`] = set;
      return { ...level, stairs: kept };
    });

    const views = Array.isArray(project.drawingViews)
      ? partitioned(
          project.drawingViews as readonly unknown[],
          looksLikeDrawingView,
        )
      : undefined;
    if (views !== undefined && views.set.length > 0)
      setAside['drawingViews'] = views.set;

    const extensions = isRecord(input.extensions) ? input.extensions : {};
    return {
      ...input,
      schemaVersion: '1.1.0',
      project: {
        ...project,
        ...(building === undefined
          ? {}
          : { building: { ...building, levels: migratedLevels } }),
        ...(views === undefined ? {} : { drawingViews: views.kept }),
      },
      ...(Object.keys(setAside).length === 0
        ? {}
        : {
            extensions: {
              ...extensions,
              // Kept, named, and reachable — never thrown away in silence.
              [LEGACY_EXTENSION]: setAside,
            },
          }),
    };
  },
};

/**
 * What an older file called a port, and what it certainly meant.
 *
 * A port used to say a free `role` and a direction; the model now names the
 * kind, from which the fluid, the service and the way it is joined are read.
 *
 * The pair does not determine the kind in general, and the reference house
 * proved it on the first run: in an extract system a terminal sends extract
 * air *out* into the duct while the fan sends exhaust air *out* to the sky,
 * and the same is true of a heating flow arriving *in* at an emitter. Only the
 * systems whose two ends carry the same kind can be migrated with certainty —
 * the cold water leaving a manifold is the cold water arriving at a tap.
 *
 * The rest keep saying what they said. An inference nobody can check is worse
 * than an old field somebody can still read, and a network claiming a fluid
 * nobody chose is worse than both.
 */
const LEGACY_PORT_KINDS: Readonly<Record<string, string>> = {
  POTABLE_COLD: 'WATER_COLD',
  POTABLE_HOT: 'WATER_HOT',
  NON_POTABLE: 'WATER_NON_POTABLE',
  ELECTRICAL: 'ELECTRICAL_AC',
  LIGHTING: 'ELECTRICAL_AC',
  POWER: 'ELECTRICAL_AC',
};

/** The kind a legacy port certainly was, when it certainly was one. */
function legacyPortKind(systemType: unknown): string | undefined {
  return typeof systemType === 'string'
    ? LEGACY_PORT_KINDS[systemType]
    : undefined;
}

/**
 * Where a 1.1.0 file hid what the catalogue entry was.
 *
 * The interface used to copy a catalogue entry into the project by writing its
 * identifier and version *inside* `properties`, under names nothing read.
 * Moving them to the fields that mean them is the whole of what this
 * migration invents, and it invents nothing: the values were already in the
 * file, under a different roof.
 */
function liftedEquipment(entry: unknown): unknown {
  if (!isRecord(entry)) return entry;
  const properties = isRecord(entry.properties) ? entry.properties : {};
  const version = properties.catalogDefinitionVersion;
  const name = properties.name;
  const {
    catalogDefinitionId: _id,
    catalogDefinitionVersion: _version,
    ...rest
  } = properties;
  return {
    ...entry,
    ...(entry.version === undefined && typeof version === 'string'
      ? { version }
      : {}),
    ...(entry.name === undefined && typeof name === 'string' ? { name } : {}),
    properties: rest,
  };
}

export const migration110To120: ProjectMigration = {
  id: 'project-1.1.0-to-1.2.0',
  from: '1.1.0',
  to: '1.2.0',
  migrate(input: unknown): unknown {
    if (!isRecord(input) || !isRecord(input.project))
      throw new TypeError('A 1.1.0 file must contain a project.');
    const project = input.project;
    const building = isRecord(project.building) ? project.building : undefined;
    const equipment = Array.isArray(project.equipment)
      ? (project.equipment as readonly unknown[]).map(liftedEquipment)
      : undefined;
    const systems = Array.isArray(project.systems)
      ? (project.systems as readonly unknown[]).map((network) => {
          if (!isRecord(network) || !Array.isArray(network.ports))
            return network;
          return {
            ...network,
            ports: (network.ports as readonly unknown[]).map((port) => {
              if (!isRecord(port) || port.portTypeId !== undefined) return port;
              const kind = legacyPortKind(network.systemType);
              // A port whose kind cannot be told from what the file says keeps
              // saying what it said. Guessing would make the network claim a
              // fluid nobody chose.
              return kind === undefined ? port : { ...port, portTypeId: kind };
            }),
          };
        })
      : undefined;
    return {
      ...input,
      schemaVersion: '1.2.0',
      project: {
        ...project,
        ...(building === undefined ? {} : { building }),
        ...(equipment === undefined ? {} : { equipment }),
        ...(systems === undefined ? {} : { systems }),
      },
    };
  },
};

export const DEFAULT_PROJECT_MIGRATIONS: readonly ProjectMigration[] = [
  migration090To100,
  migration100To110,
  migration110To120,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
