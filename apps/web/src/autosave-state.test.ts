import { describe, expect, it } from 'vitest';
import { announcesSaved } from './autosave.js';
import { createAutosaveQueue } from './autosave-queue.js';

/**
 * The sequence the sixth and seventh audits both pointed at.
 *
 * The queue serialises writes, which was necessary and not sufficient: the
 * state bar is set by a callback that captured a revision, and that revision
 * may no longer be the one on screen when the write finishes. Announcing
 * "saved" then does two wrong things at once — it claims a snapshot that is one
 * revision behind, and it takes the workspace out of "modified", which cancels
 * the newer snapshot's own timer.
 */
describe('what the state bar may claim after a write', () => {
  it('says nothing when the session moved on while the write ran', () => {
    // Revision 50 is written; the user edited meanwhile, so the session is at
    // 51 and the store is one revision behind what is on screen.
    expect(announcesSaved('p@50', 'p@50', 'p@51')).toBe(false);
    expect(announcesSaved('p@51', 'p@51', 'p@51')).toBe(true);
  });

  it('says nothing when an older write is the one that resolved', () => {
    expect(announcesSaved('p@50', 'p@51', 'p@51')).toBe(false);
  });

  it('tells two projects at the same revision apart', () => {
    // Opening another project that happens to sit at revision 12 must not make
    // the snapshot of the first one look like the state of the second.
    expect(announcesSaved('house@12', 'house@12', 'shed@12')).toBe(false);
  });

  it('says nothing when the write was refused', () => {
    expect(announcesSaved(undefined, 'p@50', 'p@50')).toBe(false);
  });

  it('leaves the newer snapshot free to be written and announced', async () => {
    const gates: (() => void)[] = [];
    const store: string[] = [];
    const queue = createAutosaveQueue(async (identity: string) => {
      await new Promise<void>((resolve) => gates.push(resolve));
      store.push(identity);
      return identity;
    });

    // The whole sequence: 50 starts writing, the user edits, 50 lands.
    const fiftieth = queue.enqueue('p@50');
    let session = 'p@51';
    gates.shift()!();
    expect(announcesSaved(await fiftieth, 'p@50', session)).toBe(false);

    // The timer for 51 was never cancelled, so its snapshot goes through.
    const fiftyFirst = queue.enqueue('p@51');
    gates.shift()!();
    expect(announcesSaved(await fiftyFirst, 'p@51', session)).toBe(true);
    expect(store).toEqual(['p@50', 'p@51']);

    // And what is in the store is what is on screen.
    session = 'p@51';
    expect(store.at(-1)).toBe(session);
  });
});
