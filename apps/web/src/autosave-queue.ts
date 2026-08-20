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
  /**
   * Runs something once nothing is queued and nothing is being written.
   *
   * Removing the snapshot is the reason this exists. Clearing the store beside
   * the queue lets a write that was already under way finish afterwards and put
   * the snapshot back — the user asked for it to be gone and it returns. Here
   * the write in flight is awaited, everything queued before or during is
   * dropped, and only then does the action run.
   */
  barrier(action: () => Promise<void>): Promise<void>;
  /** The key of the last snapshot written. */
  written(): string | undefined;
}

export function createAutosaveQueue<T>(
  write: (snapshot: T) => Promise<string>,
): AutosaveQueue<T> {
  let queued: T | undefined;
  let flushing: Promise<void> | undefined;
  let written: string | undefined;
  /** While a barrier is running, no snapshot may reach the store. */
  let blocked = false;

  const flush = async (): Promise<void> => {
    while (queued !== undefined) {
      const snapshot = queued;
      queued = undefined;
      written = await write(snapshot);
    }
  };

  const start = (): Promise<void> => {
    flushing ??= flush().finally(() => {
      flushing = undefined;
    });
    return flushing;
  };

  return {
    enqueue: async (snapshot) => {
      // A snapshot handed over while the store is being emptied belongs to the
      // state being discarded; writing it would undo the removal. Nothing of
      // this caller's is in the store, and that is what it is told — reporting
      // the key of an earlier write would let it believe it was saved.
      if (blocked) return undefined;
      queued = snapshot;
      await start();
      return written;
    },
    cancelPending: () => {
      queued = undefined;
    },
    barrier: async (action) => {
      blocked = true;
      queued = undefined;
      try {
        while (flushing !== undefined) await flushing;
        await action();
        // Nothing is in the store any more, so no key describes it.
        written = undefined;
      } finally {
        blocked = false;
      }
    },
    written: () => written,
  };
}
