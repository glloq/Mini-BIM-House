import type { ProjectFile } from '@house-technical-designer/core-domain';
import {
  autosaveProject,
  clearAutosave,
  createStorageAutosaveStore,
  recoverAutosave,
  type RecoveryResult,
} from '@house-technical-designer/project-io';

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

function store() {
  return createStorageAutosaveStore(window.localStorage);
}

/** Writes a snapshot of the project into this browser. */
export async function writeAutosave(file: ProjectFile): Promise<void> {
  await autosaveProject(store(), AUTOSAVE_KEY, file, () =>
    new Date().toISOString(),
  );
}

/** Reads back a snapshot left by a previous session, if any. */
export async function readAutosave(): Promise<RecoveryResult> {
  return recoverAutosave(store(), AUTOSAVE_KEY);
}

/** Drops the snapshot once the user has decided what to do with it. */
export async function discardAutosave(): Promise<void> {
  await clearAutosave(store(), AUTOSAVE_KEY);
}
