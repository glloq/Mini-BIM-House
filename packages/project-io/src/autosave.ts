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

/** Where the snapshot that the current one replaced is kept. */
export function previousKey(key: string): string {
  return `${key}:previous`;
}

/**
 * Writes a snapshot, keeping the one it replaces.
 *
 * Two snapshots are what makes a recovery possible when the last write caught
 * the project mid-mistake, or landed corrupt: the previous one is still there,
 * and the reader falls back to it rather than reporting nothing at all.
 */
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
  const current = await store.get(key);
  if (current !== undefined) await store.set(previousKey(key), current);
  await store.set(key, JSON.stringify(record));
  return record;
}

/**
 * Reads back the snapshot a previous session left.
 *
 * A snapshot that cannot be read is not the end of the story: the one it
 * replaced is tried before giving up, and the result says which one was found.
 */
export async function recoverAutosave(
  store: AutosaveStore,
  key: string,
): Promise<RecoveryResult> {
  const current = await readSnapshot(store, key);
  if (current.status !== 'CORRUPT') return current;
  const previous = await readSnapshot(store, previousKey(key));
  return previous.status === 'RECOVERED' ? previous : current;
}

async function readSnapshot(
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
  await store.remove(previousKey(key));
}

/**
 * A store backed by IndexedDB.
 *
 * The import limits admit projects of tens of megabytes, which no browser will
 * keep in local storage; IndexedDB is where a snapshot of a real project fits.
 * A runtime without it — an old browser, a private window that refuses the
 * database — returns nothing rather than pretending to have saved.
 */
export function createIndexedDbAutosaveStore(
  factory: IDBFactory,
  databaseName = 'house-technical-designer',
  storeName = 'autosave',
): AutosaveStore {
  const open = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const request = factory.open(databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName))
          request.result.createObjectStore(storeName);
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error('IndexedDB could not be opened.'));
      };
    });
  const run = async <T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> => {
    const database = await open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(storeName, mode);
        const request = action(transaction.objectStore(storeName));
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(request.error ?? new Error('IndexedDB request failed.'));
        };
      });
    } finally {
      database.close();
    }
  };
  return {
    get: async (key) => {
      const value = await run<unknown>('readonly', (store) => store.get(key));
      return typeof value === 'string' ? value : undefined;
    },
    set: async (key, value) => {
      await run('readwrite', (store) => store.put(value, key));
    },
    remove: async (key) => {
      await run('readwrite', (store) => store.delete(key));
    },
  };
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
