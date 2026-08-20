/**
 * One write at a time, and the newest snapshot always last.
 *
 * Writing a snapshot takes long enough for the project to be edited again
 * meanwhile. Two writes racing would decide by chance which state ends up on
 * disk, and the older one could be the last to land — leaving the application
 * saying "saved" over a snapshot that is not what is on screen. Requests are
 * therefore serialised, and a request made while a write is in flight replaces
 * whatever was still waiting: intermediate states have no value, only the last
 * one does.
 */
export interface AutosaveQueue<T> {
  /**
   * Queues a snapshot and resolves with the key of the one actually written
   * last, which may be newer than the one this call passed.
   */
  enqueue(snapshot: T): Promise<string | undefined>;
  /** Forgets what is still waiting; a write already in flight still finishes. */
  cancelPending(): void;
  /** The key of the last snapshot written. */
  written(): string | undefined;
}

export function createAutosaveQueue<T>(
  write: (snapshot: T) => Promise<string>,
): AutosaveQueue<T> {
  let queued: T | undefined;
  let flushing: Promise<void> | undefined;
  let written: string | undefined;

  const flush = async (): Promise<void> => {
    while (queued !== undefined) {
      const snapshot = queued;
      queued = undefined;
      written = await write(snapshot);
    }
  };

  return {
    enqueue: async (snapshot) => {
      queued = snapshot;
      flushing ??= flush().finally(() => {
        flushing = undefined;
      });
      await flushing;
      return written;
    },
    cancelPending: () => {
      queued = undefined;
    },
    written: () => written,
  };
}
