/**
 * The next value of a project's edit revision.
 *
 * The revision identifies an edit, not a state: it only ever moves forward, so
 * undoing an edit produces a new revision rather than returning to the previous
 * one, and a scenario recorded against a given revision can always tell whether
 * the project has moved since. A value the counter cannot read — a hand-written
 * label such as `reference-1` — restarts it at 1 rather than being kept,
 * because a revision nobody can compare is not one.
 */
export function nextRevision(current: string | undefined): string {
  if (current === undefined || !/^\d+$/u.test(current.trim())) return '1';
  return String(BigInt(current.trim()) + 1n);
}
