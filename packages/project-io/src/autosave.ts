import type { ProjectFile } from '@house-technical-designer/core-domain';
import type { MigrationJournalEntry } from './migrations.js';
import { loadProjectJson, serializeProjectFile } from './project-io.js';

export interface AutosaveStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AutosaveRecord {
  readonly format: 'house-technical-designer-autosave';
  readonly savedAt: string;
  readonly projectJson: string;
}

export type RecoveryResult =
  | { readonly status: 'EMPTY' }
  | {
      readonly status: 'RECOVERED';
      readonly savedAt: string;
      readonly file: ProjectFile;
      readonly migrationJournal: readonly MigrationJournalEntry[];
    }
  | { readonly status: 'CORRUPT'; readonly message: string };

export async function autosaveProject(
  store: AutosaveStore,
  key: string,
  file: ProjectFile,
  now: () => string,
): Promise<AutosaveRecord> {
  if (key.trim() === '') throw new TypeError('Autosave key must not be empty.');
  const savedAt = now();
  if (!isIsoTimestamp(savedAt))
    throw new RangeError(
      'Autosave timestamp must be an ISO 8601 UTC timestamp.',
    );
  const record: AutosaveRecord = {
    format: 'house-technical-designer-autosave',
    savedAt,
    projectJson: serializeProjectFile(file),
  };
  await store.set(key, JSON.stringify(record));
  return record;
}

export async function recoverAutosave(
  store: AutosaveStore,
  key: string,
): Promise<RecoveryResult> {
  const source = await store.get(key);
  if (source === undefined) return { status: 'EMPTY' };
  let record: unknown;
  try {
    record = JSON.parse(source) as unknown;
  } catch (error: unknown) {
    return {
      status: 'CORRUPT',
      message:
        error instanceof Error ? error.message : 'Invalid autosave JSON.',
    };
  }
  if (
    !isRecord(record) ||
    record.format !== 'house-technical-designer-autosave' ||
    typeof record.savedAt !== 'string' ||
    !isIsoTimestamp(record.savedAt) ||
    typeof record.projectJson !== 'string'
  ) {
    return { status: 'CORRUPT', message: 'Autosave envelope is invalid.' };
  }
  const loaded = loadProjectJson(record.projectJson);
  if (loaded.status !== 'OK')
    return {
      status: 'CORRUPT',
      message: `Autosaved project is invalid: ${loaded.status}.`,
    };
  return {
    status: 'RECOVERED',
    savedAt: record.savedAt,
    file: loaded.file,
    migrationJournal: loaded.migrationJournal,
  };
}

export async function clearAutosave(
  store: AutosaveStore,
  key: string,
): Promise<void> {
  await store.remove(key);
}

export function createStorageAutosaveStore(
  storage: StorageLike,
): AutosaveStore {
  return {
    get: async (key) => storage.getItem(key) ?? undefined,
    set: async (key, value) => storage.setItem(key, value),
    remove: async (key) => storage.removeItem(key),
  };
}

function isIsoTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value))
    return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  const normalizedInput = value.includes('.')
    ? value
    : value.replace('Z', '.000Z');
  return new Date(timestamp).toISOString() === normalizedInput;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
