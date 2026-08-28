import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEGACY_EXTENSION } from './index.js';
import { loadProjectJson } from './file-io.js';

function fixture(name: string): string {
  return readFileSync(
    new URL(`../test/fixtures/legacy/${name}`, import.meta.url),
    'utf8',
  );
}

/**
 * A file a released version accepted must keep opening.
 *
 * Under 1.0.0 the schema took `stairs` and `drawingViews` as arrays of
 * anything. 1.1.0 gives both a contract, and a contract is a narrowing: a file
 * that was valid yesterday could otherwise be refused today, which is exactly
 * what a schema version exists to prevent. These fixtures are the proof that
 * it does not happen.
 */
describe('files written under the 1.0.0 contract', () => {
  it('still opens one whose content already fits the new shape', () => {
    const result = loadProjectJson(fixture('typed-1.0.0.json'));
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    expect(result.file.schemaVersion).toBe('1.3.0');
    expect(result.migrationJournal).toEqual([
      { migrationId: 'project-1.0.0-to-1.1.0', from: '1.0.0', to: '1.1.0' },
      { migrationId: 'project-1.1.0-to-1.2.0', from: '1.1.0', to: '1.2.0' },
      { migrationId: 'project-1.2.0-to-1.3.0', from: '1.2.0', to: '1.3.0' },
    ]);
    // Read, not merely carried: the stair is now a stair.
    const stair = result.file.project.building.levels[0]!.stairs[0]!;
    expect(stair.riserCount).toBe(16);
    expect(result.file.project.drawingViews?.[0]?.name).toBe(
      'Plan du rez-de-chaussée',
    );
  });

  it('still opens one whose content nothing can read', () => {
    const result = loadProjectJson(fixture('opaque-1.0.0.json'));
    expect(result.status).toBe('OK');
  });

  it('keeps what it could not convert where it can be found again', () => {
    // Dropping it silently would lose data the user never agreed to lose;
    // refusing the file would lock them out of their own project.
    const result = loadProjectJson(fixture('opaque-1.0.0.json'));
    if (result.status !== 'OK') return;
    expect(result.file.project.building.levels[0]!.stairs).toEqual([]);
    expect(result.file.project.drawingViews).toEqual([]);
    const kept = result.file.extensions?.[LEGACY_EXTENSION] as
      Readonly<Record<string, readonly unknown[]>> | undefined;
    expect(kept?.['building/levels/0/stairs']).toHaveLength(2);
    expect(kept?.drawingViews).toHaveLength(2);
  });

  it('says which migration it ran rather than upgrading in silence', () => {
    const result = loadProjectJson(fixture('opaque-1.0.0.json'));
    if (result.status !== 'OK') return;
    expect(result.migrationJournal?.map(({ to }) => to)).toEqual([
      '1.1.0',
      '1.2.0',
      '1.3.0',
    ]);
  });

  it('leaves a file already at the current version alone', () => {
    const current = fixture('typed-1.0.0.json').replace('"1.0.0"', '"1.3.0"');
    const result = loadProjectJson(current);
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    expect(result.migrationJournal ?? []).toEqual([]);
    expect(result.file.extensions?.[LEGACY_EXTENSION]).toBeUndefined();
  });
});
