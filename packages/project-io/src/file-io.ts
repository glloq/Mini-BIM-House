/**
 * Lire et écrire un fichier de projet : tout ce qui passe par le schéma.
 *
 * Séparé de `project-io.ts` pour une raison qui se mesure. Le validateur
 * compilé par Ajv pèse quatre cent trente-huit kilo-octets de source, et il
 * arrivait au **premier écran** parce que le barillet du paquet le
 * réexportait : l'application importait `applyProjectScenario` pour lire une
 * variante, et emportait avec lui de quoi valider un fichier qu'elle n'avait
 * pas encore ouvert.
 *
 * Ouvrir, enregistrer, exporter sont des gestes que quelqu'un fait ; dessiner
 * un plan n'en est pas un. Ce module vit donc derrière son propre
 * sous-chemin — `@house-technical-designer/project-io/files` — et
 * l'application le charge au moment où l'on clique, comme elle charge déjà la
 * maison de démonstration et la nomenclature.
 */
import type { ProjectFile } from '@house-technical-designer/core-domain';

import validateProjectSchema from './generated-project-validator.js';
import {
  DEFAULT_PROJECT_MIGRATIONS,
  runMigrationChain,
  type MigrationJournalEntry,
  type ProjectMigration,
} from './migrations.js';
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  DEFAULT_PROJECT_IMPORT_LIMITS,
  exceededLimit,
  validateProjectReferences,
  type ProjectImportLimits,
  type ProjectLoadResult,
  type ProjectValidationIssue,
} from './project-io.js';

/** Un objet, et non un tableau ni `null` : ce qu'un fichier JSON doit être. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function loadProjectJson(
  source: string,
  migrations: readonly ProjectMigration[] = DEFAULT_PROJECT_MIGRATIONS,
  limits: ProjectImportLimits = DEFAULT_PROJECT_IMPORT_LIMITS,
): ProjectLoadResult {
  if (source.length > limits.maximumCharacters)
    return {
      status: 'TOO_LARGE',
      breach: {
        limit: 'maximumCharacters',
        label: 'caractères',
        actual: source.length,
        maximum: limits.maximumCharacters,
      },
    };
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
  const breach = exceededLimit(file, limits);
  if (breach !== undefined) return { status: 'TOO_LARGE', breach };
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

/** Les deux aides que la lecture et l'écriture d'un fichier demandent. */
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
