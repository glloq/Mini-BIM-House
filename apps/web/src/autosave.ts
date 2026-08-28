import type { ProjectFile } from '@house-technical-designer/core-domain';
import type { ClimateDataset } from '@house-technical-designer/climate';
import {
  autosaveProject,
  clearAutosave,
  createFallbackAutosaveStore,
  createIndexedDbAutosaveStore,
  createStorageAutosaveStore,
  migrateAutosave,
  recoverAutosave,
  type AutosaveStore,
  type RecoveryResult,
} from '@house-technical-designer/project-io/browser';
import { createAutosaveQueue } from './autosave-queue.js';

export const AUTOSAVE_KEY = 'house-technical-designer:autosave';

/** How long the application waits after an edit before writing a snapshot. */
export const AUTOSAVE_DELAY_MS = 1500;

/** Where the open project stands relative to what has been written out. */
export type SaveState =
  /** No edit since the project was opened or exported. */
  | 'SAVED'
  /** Edited, not yet written to the local snapshot. */
  | 'MODIFIED'
  /** Written to the local snapshot; exporting a file is still the durable copy. */
  | 'AUTOSAVED'
  | 'FAILED';

export const SAVE_STATE_LABELS: Readonly<Record<SaveState, string>> = {
  SAVED: 'Enregistré',
  MODIFIED: 'Modifié',
  AUTOSAVED: 'Sauvegardé localement · export nécessaire',
  FAILED: 'Sauvegarde locale impossible',
};

/** What a snapshot has to hold to restore the session as it was. */
export interface WorkspaceSnapshot {
  readonly file: ProjectFile;
  readonly climate: readonly ClimateDataset[];
}

/**
 * Where a snapshot of the open project is kept.
 *
 * A project the import limits admit — twenty thousand walls, fifty thousand
 * network nodes — does not fit in local storage, so the snapshot lives in
 * IndexedDB. Local storage is not chosen on the mere absence of the database
 * API: a private window or a spent quota fails at the first transaction, so it
 * is used whenever the database actually refuses, and a failure of both is
 * reported rather than swallowed.
 */
function localStore(): AutosaveStore | undefined {
  try {
    return createStorageAutosaveStore(window.localStorage);
  } catch {
    return undefined;
  }
}

let cachedStore: AutosaveStore | undefined;

function store(): AutosaveStore {
  if (cachedStore !== undefined) return cachedStore;
  const fallback = localStore();
  const database =
    typeof indexedDB === 'undefined'
      ? undefined
      : createIndexedDbAutosaveStore(indexedDB);
  if (database === undefined && fallback === undefined)
    throw new Error("Ce navigateur n'offre aucun stockage local.");
  cachedStore =
    database === undefined
      ? fallback!
      : fallback === undefined
        ? database
        : createFallbackAutosaveStore(database, fallback);
  return cachedStore;
}

/** When the last snapshot was written in this session, if one was. */
let lastSavedAt: string | undefined;

export function lastAutosaveTime(): string | undefined {
  return lastSavedAt;
}

/**
 * What identifies the state a snapshot holds.
 *
 * The revision alone is not enough: two projects can sit at the same revision,
 * and a snapshot of one would then look like a snapshot of the other. The
 * project identity is part of what is compared.
 */
export function snapshotIdentity(file: ProjectFile): string {
  return `${file.project.id}@${file.project.metadata.projectRevision ?? ''}`;
}

/**
 * Whether a finished write may be announced as "saved locally".
 *
 * Both comparisons are needed, and they say different things. The first says
 * the store holds this snapshot rather than an older write that was still
 * resolving. The second says the session has not moved on since — an edit made
 * while the snapshot was being written leaves the store one revision behind
 * what is on screen, and announcing it as saved would be untrue.
 */
export function announcesSaved(
  written: string | undefined,
  snapshot: string,
  current: string,
): boolean {
  return written === snapshot && current === snapshot;
}

/**
 * The queue that writes snapshots, one at a time and newest last.
 *
 * The identity of the snapshot written is what the caller compares against the
 * project on screen, so a stale write can never be reported as current.
 */
const queue = createAutosaveQueue<WorkspaceSnapshot>(async (snapshot) => {
  const record = await autosaveProject(
    store(),
    AUTOSAVE_KEY,
    snapshot.file,
    () => new Date().toISOString(),
    snapshot.climate.map((dataset) => JSON.stringify(dataset)),
  );
  lastSavedAt = record.savedAt;
  return snapshotIdentity(snapshot.file);
});

/**
 * Writes a snapshot of the workspace into this browser.
 *
 * Resolves with the identity that actually reached the store, which is not
 * necessarily the one this call was given: a newer snapshot queued while this
 * one was being written wins, and the caller can see that its own state is not
 * the one on disk.
 */
export async function writeAutosave(
  snapshot: WorkspaceSnapshot,
): Promise<string | undefined> {
  return queue.enqueue(snapshot);
}

/** Reads back a snapshot left by a previous session, if any. */
export async function readAutosave(): Promise<RecoveryResult> {
  const current = store();
  const previous = localStore();
  // A snapshot written by an earlier version lived in local storage; it is
  // moved rather than left behind, so updating the application never looks
  // like losing the work in progress.
  if (previous !== undefined)
    await migrateAutosave(previous, current, AUTOSAVE_KEY).catch(
      () => undefined,
    );
  return recoverAutosave(current, AUTOSAVE_KEY);
}

/**
 * Drops the snapshot once the user has decided what to do with it.
 *
 * The removal goes through the write queue rather than beside it: a write
 * already under way finishes first and everything queued behind it is
 * abandoned, so the snapshot the user asked to delete cannot come back a
 * moment later.
 */
export async function discardAutosave(): Promise<void> {
  await queue.barrier(async () => {
    await clearAutosave(store(), AUTOSAVE_KEY);
    lastSavedAt = undefined;
  });
}
