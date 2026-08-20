import { describe, expect, it } from 'vitest';
import {
  autosaveProject,
  createFallbackAutosaveStore,
  migrateAutosave,
  recoverAutosave,
  type AutosaveStore,
} from './autosave.js';
import { loadProjectJson } from './project-io.js';

const raw = {
  format: 'house-technical-designer-project',
  schemaVersion: '1.0.0',
  project: {
    id: 'project',
    metadata: {
      name: 'House',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      projectRevision: '1',
    },
    site: { northAngleDeg: 0 },
    building: { levels: [], zones: [] },
  },
};
const loaded = loadProjectJson(JSON.stringify(raw));
if (loaded.status !== 'OK') throw new Error('fixture must be valid');
const base = loaded.file;

function at(revision: string) {
  return {
    ...base,
    project: {
      ...base.project,
      metadata: { ...base.project.metadata, projectRevision: revision },
    },
  };
}

function failingStore(): AutosaveStore {
  return {
    get: () => Promise.reject(new Error('database refused')),
    set: () => Promise.reject(new Error('database refused')),
    remove: () => Promise.reject(new Error('database refused')),
  };
}

function memoryStore(): AutosaveStore {
  const values = new Map<string, string>();
  return {
    get: async (key) => values.get(key),
    set: async (key, value) => {
      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
  };
}

const KEY = 'current';

describe('what a snapshot carries', () => {
  it('carries the climate the session was working with', async () => {
    const store = memoryStore();
    await autosaveProject(
      store,
      KEY,
      at('7'),
      () => '2026-01-01T00:00:00.000Z',
      ['{"id":"brest"}'],
    );
    const recovered = await recoverAutosave(store, KEY);
    expect(recovered.status).toBe('RECOVERED');
    if (recovered.status !== 'RECOVERED') return;
    expect(recovered.climateJson).toEqual(['{"id":"brest"}']);
  });

  it('reads a snapshot written before the climate travelled with it', async () => {
    const store = memoryStore();
    await store.set(
      KEY,
      JSON.stringify({
        format: 'house-technical-designer-autosave',
        savedAt: '2026-01-01T00:00:00.000Z',
        projectJson: JSON.stringify(raw),
      }),
    );
    const recovered = await recoverAutosave(store, KEY);
    expect(recovered.status).toBe('RECOVERED');
    if (recovered.status !== 'RECOVERED') return;
    expect(recovered.climateJson).toEqual([]);
  });
});

describe('when the database refuses', () => {
  it('writes to the fallback instead of losing the snapshot', async () => {
    const fallback = memoryStore();
    const store = createFallbackAutosaveStore(failingStore(), fallback);
    await autosaveProject(
      store,
      KEY,
      at('3'),
      () => '2026-01-01T00:00:00.000Z',
    );
    expect(await fallback.get(KEY)).toBeDefined();
    const recovered = await recoverAutosave(store, KEY);
    expect(recovered.status).toBe('RECOVERED');
  });

  it('reports the failure when neither store accepts the write', async () => {
    const store = createFallbackAutosaveStore(failingStore(), failingStore());
    await expect(
      autosaveProject(store, KEY, at('3'), () => '2026-01-01T00:00:00.000Z'),
    ).rejects.toThrow();
  });
});

describe('a snapshot left by an earlier version', () => {
  it('is moved into the store now in use, then removed from the old one', async () => {
    const previous = memoryStore();
    const current = memoryStore();
    await autosaveProject(
      previous,
      KEY,
      at('9'),
      () => '2026-01-01T00:00:00.000Z',
    );
    expect(await migrateAutosave(previous, current, KEY)).toBe('MIGRATED');
    expect(await previous.get(KEY)).toBeUndefined();
    const recovered = await recoverAutosave(current, KEY);
    expect(recovered.status).toBe('RECOVERED');
    if (recovered.status !== 'RECOVERED') return;
    expect(recovered.file.project.metadata.projectRevision).toBe('9');
  });

  it('never overwrites a snapshot the current store already holds', async () => {
    const previous = memoryStore();
    const current = memoryStore();
    await autosaveProject(
      previous,
      KEY,
      at('1'),
      () => '2026-01-01T00:00:00.000Z',
    );
    await autosaveProject(
      current,
      KEY,
      at('2'),
      () => '2026-01-01T00:00:01.000Z',
    );
    expect(await migrateAutosave(previous, current, KEY)).toBe(
      'NOTHING_TO_MIGRATE',
    );
    const recovered = await recoverAutosave(current, KEY);
    if (recovered.status !== 'RECOVERED') return;
    expect(recovered.file.project.metadata.projectRevision).toBe('2');
  });

  it('keeps the old one when the copy cannot be verified', async () => {
    const previous = memoryStore();
    await autosaveProject(
      previous,
      KEY,
      at('1'),
      () => '2026-01-01T00:00:00.000Z',
    );
    expect(await migrateAutosave(previous, failingStore(), KEY)).toBe(
      'KEPT_SOURCE',
    );
    expect(await previous.get(KEY)).toBeDefined();
  });
});
