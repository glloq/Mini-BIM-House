import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT_MIGRATIONS,
  loadProjectJson,
  runMigrationChain,
} from './index.js';

const oldSource = readFileSync(
  new URL('../test/fixtures/v0.9.0/project.json', import.meta.url),
  'utf8',
);
const expected = JSON.parse(
  readFileSync(
    new URL('../test/fixtures/v1.0.0/project.json', import.meta.url),
    'utf8',
  ),
) as unknown;

describe('project migrations', () => {
  it('migrates the old fixture to the exact current snapshot', () => {
    const original = JSON.parse(oldSource) as unknown;
    const before = structuredClone(original);
    const result = runMigrationChain(
      original,
      '1.0.0',
      DEFAULT_PROJECT_MIGRATIONS,
    );
    expect(result).toMatchObject({
      status: 'OK',
      value: expected,
      journal: [
        { migrationId: 'project-0.9.0-to-1.0.0', from: '0.9.0', to: '1.0.0' },
      ],
    });
    expect(original).toEqual(before);
  });
  it('automatically migrates during load and reports its journal', () => {
    expect(loadProjectJson(oldSource)).toMatchObject({
      status: 'OK',
      file: expected,
      migrationJournal: [{ from: '0.9.0', to: '1.0.0' }],
    });
  });
  it('is deterministic across repeated runs', () => {
    expect(loadProjectJson(oldSource)).toEqual(loadProjectJson(oldSource));
  });
  it('fails explicitly when no sequential path exists', () => {
    const source = oldSource.replace('"0.9.0"', '"0.8.0"');
    expect(loadProjectJson(source, [])).toMatchObject({
      status: 'MIGRATION_ERROR',
      message: expect.stringContaining('No migration path'),
    });
  });
});
