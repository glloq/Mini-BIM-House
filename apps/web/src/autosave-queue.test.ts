import { describe, expect, it } from 'vitest';
import { createAutosaveQueue } from './autosave-queue.js';

/** A writer that finishes only when the test lets it. */
function controlled() {
  const started: string[] = [];
  const gates: (() => void)[] = [];
  let open = false;
  return {
    started,
    /** Lets every write through, now and afterwards. */
    releaseAll(): void {
      open = true;
      for (const gate of gates.splice(0)) gate();
    },
    write: async (revision: string): Promise<string> => {
      started.push(revision);
      if (!open) await new Promise<void>((resolve) => gates.push(resolve));
      return revision;
    },
  };
}

describe('snapshots queued while one is being written', () => {
  it('writes them one at a time, in order', async () => {
    const writer = controlled();
    const queue = createAutosaveQueue(writer.write);
    const first = queue.enqueue('50');
    // The second request arrives while the first write is still in flight.
    const second = queue.enqueue('51');
    expect(writer.started).toEqual(['50']);
    writer.releaseAll();
    expect(await first).toBe('51');
    expect(await second).toBe('51');
    expect(writer.started).toEqual(['50', '51']);
  });

  it('reports the revision on disk, not the one it was handed', async () => {
    const writer = controlled();
    const queue = createAutosaveQueue(writer.write);
    // Revision 50 is being written when 51 and 52 arrive; 51 never reaches the
    // store, and the call that asked for 50 learns that 52 is what is saved.
    const first = queue.enqueue('50');
    void queue.enqueue('51');
    const last = queue.enqueue('52');
    writer.releaseAll();
    expect(await first).toBe('52');
    expect(await last).toBe('52');
    expect(writer.started).toEqual(['50', '52']);
    expect(queue.written()).toBe('52');
  });

  it('forgets what was still waiting when the snapshot is discarded', async () => {
    const writer = controlled();
    const queue = createAutosaveQueue(writer.write);
    const first = queue.enqueue('1');
    void queue.enqueue('2');
    queue.cancelPending();
    writer.releaseAll();
    expect(await first).toBe('1');
    expect(writer.started).toEqual(['1']);
  });

  it('never lets a write in flight put back a deleted snapshot', async () => {
    const writer = controlled();
    const store = { snapshot: undefined as string | undefined };
    const queue = createAutosaveQueue(async (revision: string) => {
      const key = await writer.write(revision);
      store.snapshot = key;
      return key;
    });
    // The write of 50 has started when the user asks for the snapshot to go.
    const pending = queue.enqueue('50');
    expect(writer.started).toEqual(['50']);
    const cleared = queue.barrier(async () => {
      store.snapshot = undefined;
    });
    writer.releaseAll();
    await Promise.all([pending, cleared]);
    // The removal ran after the write that was under way, not before it.
    expect(store.snapshot).toBeUndefined();
    expect(queue.written()).toBeUndefined();
  });

  it('refuses a snapshot handed over while the deletion is running', async () => {
    const writer = controlled();
    writer.releaseAll();
    const store = { snapshot: undefined as string | undefined };
    const queue = createAutosaveQueue(async (revision: string) => {
      const key = await writer.write(revision);
      store.snapshot = key;
      return key;
    });
    await queue.enqueue('50');
    let during: string | undefined = 'not attempted';
    await queue.barrier(async () => {
      store.snapshot = undefined;
      // An autosave timer firing during the removal belongs to the state being
      // discarded; writing it would undo what the user just asked for.
      during = await queue.enqueue('51');
    });
    expect(during).toBeUndefined();
    expect(store.snapshot).toBeUndefined();
    expect(writer.started).toEqual(['50']);
    // Once the removal is over, the queue takes snapshots again.
    expect(await queue.enqueue('52')).toBe('52');
    expect(store.snapshot).toBe('52');
  });

  it('lets a failing write reject without wedging the queue', async () => {
    let attempts = 0;
    const queue = createAutosaveQueue(async (revision: string) => {
      attempts += 1;
      if (attempts === 1) throw new Error('database refused');
      return revision;
    });
    await expect(queue.enqueue('1')).rejects.toThrow('database refused');
    expect(await queue.enqueue('2')).toBe('2');
  });
});
