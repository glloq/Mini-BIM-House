import { describe, expect, it } from 'vitest';
import {
  autosaveProject,
  clearAutosave,
  previousKey,
  recoverAutosave,
  type AutosaveStore,
} from './autosave.js';
import { loadProjectJson } from './project-io.js';

const rawFile = {
  format: 'house-technical-designer-project',
  schemaVersion: '1.1.0',
  project: {
    id: 'project',
    metadata: {
      name: 'House',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    site: { northAngleDeg: 0 },
    building: { levels: [], zones: [] },
  },
};
const loadedFixture = loadProjectJson(JSON.stringify(rawFile));
if (loadedFixture.status !== 'OK')
  throw new Error('Autosave test fixture must be valid.');
const file = loadedFixture.file;

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

describe('local autosave', () => {
  it('validates before saving and recovers after a simulated crash', async () => {
    const store = memoryStore();
    await autosaveProject(store, 'current', file, () => '2026-08-19T12:00:00Z');
    expect(await recoverAutosave(store, 'current')).toMatchObject({
      status: 'RECOVERED',
      savedAt: '2026-08-19T12:00:00Z',
      file,
    });
  });
  it('reports corrupt records rather than silently replacing them', async () => {
    const store = memoryStore();
    await store.set('current', '{');
    expect(await recoverAutosave(store, 'current')).toMatchObject({
      status: 'CORRUPT',
    });
  });
  it('clears recovery state explicitly', async () => {
    const store = memoryStore();
    await autosaveProject(store, 'current', file, () => '2026-08-19T12:00:00Z');
    await clearAutosave(store, 'current');
    expect(await recoverAutosave(store, 'current')).toEqual({
      status: 'EMPTY',
    });
  });
  it('requires an injected deterministic timestamp', async () => {
    await expect(
      autosaveProject(memoryStore(), 'current', file, () => 'today'),
    ).rejects.toThrow(RangeError);
  });
});

const KEY = 'current';

/** The same project under another name, so two snapshots differ. */
function renamed(name: string): typeof file {
  return {
    ...file,
    project: { ...file.project, metadata: { ...file.project.metadata, name } },
  };
}

describe('two snapshots rather than one', () => {
  it('keeps the snapshot a new one replaces', async () => {
    const store = memoryStore();
    await autosaveProject(store, KEY, file, () => '2026-01-01T00:00:00.000Z');
    await autosaveProject(
      store,
      KEY,
      renamed('Renommé'),
      () => '2026-01-01T00:01:00.000Z',
    );
    const kept = await store.get(previousKey(KEY));
    expect(kept).toBeDefined();
    const record = JSON.parse(kept!) as { readonly savedAt: string };
    expect(record.savedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('falls back to it when the last write cannot be read', async () => {
    const store = memoryStore();
    await autosaveProject(store, KEY, file, () => '2026-01-01T00:00:00.000Z');
    await autosaveProject(
      store,
      KEY,
      renamed('Renommé'),
      () => '2026-01-01T00:01:00.000Z',
    );
    await store.set(KEY, '{ this is not json');
    const recovered = await recoverAutosave(store, KEY);
    expect(recovered.status).toBe('RECOVERED');
    if (recovered.status !== 'RECOVERED') return;
    expect(recovered.savedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(recovered.file.project.metadata.name).toBe('House');
  });

  it('reports the corruption when neither snapshot can be read', async () => {
    const store = memoryStore();
    await autosaveProject(store, KEY, file, () => '2026-01-01T00:00:00.000Z');
    await store.set(KEY, '{ this is not json');
    expect((await recoverAutosave(store, KEY)).status).toBe('CORRUPT');
  });

  it('drops both when the user declines the recovery', async () => {
    const store = memoryStore();
    await autosaveProject(store, KEY, file, () => '2026-01-01T00:00:00.000Z');
    await autosaveProject(
      store,
      KEY,
      renamed('Renommé'),
      () => '2026-01-01T00:01:00.000Z',
    );
    await clearAutosave(store, KEY);
    expect(await store.get(KEY)).toBeUndefined();
    expect(await store.get(previousKey(KEY))).toBeUndefined();
  });
});
