import type { ProjectFile } from '@house-technical-designer/core-domain';
import type { MigrationJournalEntry } from './migrations.js';
/*
 * Lire et écrire un fichier de projet, chargés au moment où on le fait.
 *
 * La sauvegarde locale est ce qui restait à tenir le validateur compilé dans
 * le premier écran : l'application importe `autosave` pour installer sa file
 * d'attente, et emportait avec elle quatre cent trente-huit kilo-octets dont
 * elle n'a besoin qu'à la première modification — mille cinq cents
 * millisecondes après, au plus tôt — ou à une reprise de session, qui attend
 * déjà IndexedDB. Les deux usages sont dans des fonctions `async` ; le
 * chargement s'y fait donc sur place, et rien ne change pour l'appelant.
 */
const fileIo = () => import('./file-io.js');

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
  /**
   * The climate datasets the session was working with, serialised.
   *
   * A project restored without them recalculates something else than what the
   * user was looking at, so the snapshot carries the whole workspace rather
   * than the project alone. Records written before this field simply have
   * none.
   */
  readonly climateJson?: readonly string[];
}

export type RecoveryResult =
  | { readonly status: 'EMPTY' }
  | {
      readonly status: 'RECOVERED';
      readonly savedAt: string;
      readonly file: ProjectFile;
      /** The datasets the snapshot carried, as they were serialised. */
      readonly climateJson: readonly string[];
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
  climateJson: readonly string[] = [],
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
    projectJson: (await fileIo()).serializeProjectFile(file),
    climateJson: [...climateJson],
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
  const loaded = (await fileIo()).loadProjectJson(record.projectJson);
  if (loaded.status !== 'OK')
    return {
      status: 'CORRUPT',
      message: `Autosaved project is invalid: ${loaded.status}.`,
    };
  return {
    status: 'RECOVERED',
    savedAt: record.savedAt,
    file: loaded.file,
    climateJson: Array.isArray(record.climateJson)
      ? record.climateJson.filter(
          (entry): entry is string => typeof entry === 'string',
        )
      : [],
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

/**
 * A store that falls back when the preferred one refuses to work.
 *
 * A database that exists is not a database that writes: a private window, a
 * spent quota or a corrupt file all fail at the first transaction rather than
 * at `open`. What matters to the user is that the snapshot lands somewhere, or
 * that the failure is reported — never that it silently did not happen.
 */
export function createFallbackAutosaveStore(
  primary: AutosaveStore,
  fallback: AutosaveStore,
  onFallback?: (error: unknown) => void,
): AutosaveStore {
  const attempt = async <T>(
    first: () => Promise<T>,
    second: () => Promise<T>,
  ): Promise<T> => {
    try {
      return await first();
    } catch (error: unknown) {
      onFallback?.(error);
      return second();
    }
  };
  return {
    get: async (key) =>
      attempt(
        () => primary.get(key),
        () => fallback.get(key),
      ),
    set: async (key, value) =>
      attempt(
        () => primary.set(key, value),
        () => fallback.set(key, value),
      ),
    remove: async (key) => {
      // Both are cleared: a snapshot left in the one that is no longer read
      // would come back the next time the other one fails.
      const failures: unknown[] = [];
      for (const store of [primary, fallback])
        try {
          await store.remove(key);
        } catch (error: unknown) {
          failures.push(error);
        }
      if (failures.length === 2) throw failures[0];
    },
  };
}

/**
 * Moves a snapshot left by an earlier version into the store now in use.
 *
 * The application used to keep its snapshot in local storage. Someone who
 * updates with unexported work in progress must not find it gone because the
 * application changed where it looks; the record is copied, read back to check
 * it arrived, and only then removed from where it was.
 */
export async function migrateAutosave(
  from: AutosaveStore,
  to: AutosaveStore,
  key: string,
): Promise<'MIGRATED' | 'NOTHING_TO_MIGRATE' | 'KEPT_SOURCE'> {
  const existing = await to.get(key).catch(() => undefined);
  if (existing !== undefined) return 'NOTHING_TO_MIGRATE';
  const previous = await from.get(key).catch(() => undefined);
  if (previous === undefined) return 'NOTHING_TO_MIGRATE';
  try {
    await to.set(key, previous);
    if ((await to.get(key)) !== previous) return 'KEPT_SOURCE';
  } catch {
    return 'KEPT_SOURCE';
  }
  await from.remove(key).catch(() => undefined);
  return 'MIGRATED';
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
