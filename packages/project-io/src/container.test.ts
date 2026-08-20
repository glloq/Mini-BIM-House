import { describe, expect, it } from 'vitest';
import type { ProjectFile } from '@house-technical-designer/core-domain';
import {
  PROJECT_CONTAINER_FORMAT,
  readProjectContainer,
  writeProjectContainer,
} from './container.js';
import {
  crc32,
  DEFAULT_ZIP_LIMITS,
  looksLikeZip,
  readZip,
  writeZip,
} from './zip.js';

const LIMITS = DEFAULT_ZIP_LIMITS;

const file = {
  format: 'house-technical-designer-project' as const,
  schemaVersion: '1.0.0',
  applicationVersion: '0.1.0',
  project: {
    id: 'project',
    metadata: {
      name: 'Maison portable',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      projectRevision: '4',
    },
    site: { northAngleDeg: 0, climateProfileId: 'brest' },
    building: {
      levels: [
        {
          id: 'ground',
          name: 'Rez-de-chaussée',
          elevationMm: 0,
          defaultStoreyHeightMm: 2500,
          walls: [],
          slabs: [],
          roofs: [],
          openings: [],
          stairs: [],
          spaces: [],
          annotations: [],
        },
      ],
      zones: [],
    },
  },
} as unknown as ProjectFile;

const dataset = JSON.stringify({
  id: 'brest',
  location: { latitude: 48.4, longitude: -4.5, timezone: 'Europe/Paris' },
  resolution: 'MONTHLY',
  source: { id: 'demo', provider: 'Démonstration' },
  samples: [{ timestamp: '2026-01', airTemperatureC: 7.2 }],
});

describe('the archive a container is made of', () => {
  it('round-trips entries byte for byte', async () => {
    const payload = new TextEncoder().encode('a'.repeat(5_000));
    const archive = await writeZip([
      { name: 'small.txt', data: new TextEncoder().encode('bonjour') },
      { name: 'nested/large.txt', data: payload },
    ]);
    expect(looksLikeZip(archive)).toBe(true);
    const entries = await readZip(archive);
    expect(entries.map(({ name }) => name)).toEqual([
      'small.txt',
      'nested/large.txt',
    ]);
    expect(entries[1]?.data).toEqual(payload);
    // Repetitive text has to end up smaller than it started.
    expect(archive.length).toBeLessThan(payload.length);
  });

  it('produces the same bytes for the same content', async () => {
    const once = await writeZip([
      { name: 'a.txt', data: new TextEncoder().encode('x') },
    ]);
    const twice = await writeZip([
      { name: 'a.txt', data: new TextEncoder().encode('x') },
    ]);
    expect([...once]).toEqual([...twice]);
  });

  it('refuses an entry whose bytes were altered', async () => {
    const archive = await writeZip([
      { name: 'a.txt', data: new TextEncoder().encode('bonjour') },
    ]);
    const tampered = Uint8Array.from(archive);
    // The stored bytes sit right after the local header and the name.
    tampered[40] = (tampered[40]! + 1) % 256;
    await expect(readZip(tampered)).rejects.toThrow();
  });

  it('is not confused with a plain file', () => {
    expect(looksLikeZip(new TextEncoder().encode('{"format":"…"}'))).toBe(
      false,
    );
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('a project and its climate in one file', () => {
  it('carries the project and the datasets it needs', async () => {
    const bytes = await writeProjectContainer(file, [
      { id: 'brest', json: dataset },
    ]);
    const result = await readProjectContainer(bytes);
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    expect(result.manifest.format).toBe(PROJECT_CONTAINER_FORMAT);
    expect(result.container.file.project.metadata.name).toBe('Maison portable');
    expect(result.container.climate).toHaveLength(1);
    expect(result.container.climate[0]?.id).toBe('brest');
    expect(JSON.parse(result.container.climate[0]!.json)).toMatchObject({
      id: 'brest',
    });
  });

  it('names the entries a human unzipping it would look for', async () => {
    const bytes = await writeProjectContainer(file, [
      { id: 'brest', json: dataset },
    ]);
    expect((await readZip(bytes)).map(({ name }) => name)).toEqual([
      'manifest.json',
      'project.json',
      'climate/brest.json',
    ]);
  });

  it('tells a plain project file apart from a container', async () => {
    const plain = new TextEncoder().encode(JSON.stringify(file));
    expect(await readProjectContainer(plain)).toEqual({
      status: 'NOT_A_CONTAINER',
    });
  });

  it('refuses an archive that is not a project container', async () => {
    const archive = await writeZip([
      { name: 'notes.txt', data: new TextEncoder().encode('rien') },
    ]);
    const result = await readProjectContainer(archive);
    expect(result.status).toBe('INVALID_CONTAINER');
    if (result.status !== 'INVALID_CONTAINER') return;
    expect(result.message).toContain('manifest.json');
  });

  it('reports an invalid project rather than opening half of it', async () => {
    const broken = structuredClone(file) as unknown as Record<string, unknown>;
    (broken.project as Record<string, unknown>).site = {};
    const archive = await writeZip([
      {
        name: 'manifest.json',
        data: new TextEncoder().encode(
          JSON.stringify({
            format: PROJECT_CONTAINER_FORMAT,
            version: '1.0.0',
            project: 'project.json',
            climate: [],
          }),
        ),
      },
      {
        name: 'project.json',
        data: new TextEncoder().encode(JSON.stringify(broken)),
      },
    ]);
    const result = await readProjectContainer(archive);
    expect(result.status).toBe('INVALID_PROJECT');
    if (result.status !== 'INVALID_PROJECT') return;
    expect(result.result.status).toBe('INVALID_PROJECT');
  });
});

describe('a container carrying an older project', () => {
  it('migrates it and says so instead of upgrading it in silence', async () => {
    const { metadata, ...projectRest } = file.project;
    const older = {
      ...file,
      schemaVersion: '0.9.0',
      project: { ...projectRest, info: metadata },
    };
    const encoder = new TextEncoder();
    const bytes = await writeZip([
      {
        name: 'manifest.json',
        data: encoder.encode(
          JSON.stringify({
            format: PROJECT_CONTAINER_FORMAT,
            version: '1.0.0',
            project: 'project.json',
            climate: ['climate/brest.json'],
          }),
        ),
      },
      { name: 'project.json', data: encoder.encode(JSON.stringify(older)) },
      { name: 'climate/brest.json', data: encoder.encode(dataset) },
    ]);
    const result = await readProjectContainer(bytes);
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    expect(result.migrationJournal).toEqual([
      { migrationId: 'project-0.9.0-to-1.0.0', from: '0.9.0', to: '1.0.0' },
    ]);
    expect(result.container.file.schemaVersion).toBe('1.0.0');
    expect(result.container.file.project.metadata.name).toBe('Maison portable');
  });

  it('reports no migration for a container already at the current version', async () => {
    const result = await readProjectContainer(
      await writeProjectContainer(file, [{ id: 'brest', json: dataset }]),
    );
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    expect(result.migrationJournal).toEqual([]);
  });
});

describe('an archive that is not what it claims', () => {
  const manifest = (extra: object) =>
    new TextEncoder().encode(
      JSON.stringify({
        format: PROJECT_CONTAINER_FORMAT,
        version: '1.0.0',
        project: 'project.json',
        climate: [],
        ...extra,
      }),
    );
  const projectEntry = {
    name: 'project.json',
    data: new TextEncoder().encode(JSON.stringify(file)),
  };

  async function read(entries: readonly { name: string; data: Uint8Array }[]) {
    return readProjectContainer(await writeZip(entries));
  }

  it('refuses a climate entry the manifest declares and does not carry', async () => {
    const result = await read([
      {
        name: 'manifest.json',
        data: manifest({ climate: ['climate/paris.json'] }),
      },
      projectEntry,
    ]);
    expect(result.status).toBe('INVALID_CONTAINER');
    if (result.status !== 'INVALID_CONTAINER') return;
    expect(result.message).toContain('climate/paris.json');
  });

  it('refuses a climate entry that is not JSON', async () => {
    const result = await read([
      {
        name: 'manifest.json',
        data: manifest({ climate: ['climate/x.json'] }),
      },
      projectEntry,
      { name: 'climate/x.json', data: new TextEncoder().encode('{ nope') },
    ]);
    expect(result.status).toBe('INVALID_CONTAINER');
  });

  it('refuses a version this application does not read', async () => {
    const result = await read([
      { name: 'manifest.json', data: manifest({ version: '2.0.0' }) },
      projectEntry,
    ]);
    expect(result.status).toBe('INVALID_CONTAINER');
    if (result.status !== 'INVALID_CONTAINER') return;
    expect(result.message).toContain('2.0.0');
  });

  it('refuses a dataset the caller judges invalid', async () => {
    const archive = await writeZip([
      {
        name: 'manifest.json',
        data: manifest({ climate: ['climate/x.json'] }),
      },
      projectEntry,
      { name: 'climate/x.json', data: new TextEncoder().encode('{"id":"x"}') },
    ]);
    const result = await readProjectContainer(archive, {
      validateClimate: () => false,
    });
    expect(result.status).toBe('INVALID_CONTAINER');
    if (result.status !== 'INVALID_CONTAINER') return;
    expect(result.message).toContain('climate/x.json');
  });

  it('refuses a container missing the profile the project names', async () => {
    const named = structuredClone(file) as unknown as Record<string, unknown>;
    (named.project as Record<string, unknown>).site = {
      northAngleDeg: 0,
      climateProfileId: 'brest',
    };
    const result = await read([
      {
        name: 'manifest.json',
        data: manifest({ climate: ['climate/paris.json'] }),
      },
      {
        name: 'project.json',
        data: new TextEncoder().encode(JSON.stringify(named)),
      },
      {
        name: 'climate/paris.json',
        data: new TextEncoder().encode('{"id":"paris"}'),
      },
    ]);
    expect(result.status).toBe('INVALID_CONTAINER');
    if (result.status !== 'INVALID_CONTAINER') return;
    expect(result.message).toContain('brest');
  });

  it('refuses a container that names a profile and carries no weather at all', async () => {
    // The case the previous check let through: the archive holds nothing, so
    // "does it hold the right dataset" was never asked. A project calculated
    // on Brest, reopened elsewhere without Brest, recalculates nothing.
    const named = structuredClone(file) as unknown as Record<string, unknown>;
    (named.project as Record<string, unknown>).site = {
      northAngleDeg: 0,
      climateProfileId: 'brest',
    };
    const result = await read([
      { name: 'manifest.json', data: manifest({ climate: [] }) },
      {
        name: 'project.json',
        data: new TextEncoder().encode(JSON.stringify(named)),
      },
    ]);
    expect(result.status).toBe('INVALID_CONTAINER');
    if (result.status !== 'INVALID_CONTAINER') return;
    expect(result.message).toContain('brest');
  });

  it('refuses a manifest whose climate field is not a list of entries', async () => {
    // Read as "no climate", a malformed manifest would become a valid
    // container carrying nothing.
    for (const climate of ['climate/brest.json', 42, [7], ['']]) {
      const result = await read([
        { name: 'manifest.json', data: manifest({ climate }) },
        projectEntry,
      ]);
      expect(result.status).toBe('INVALID_CONTAINER');
      if (result.status !== 'INVALID_CONTAINER') continue;
      expect(result.message).toContain('climate');
    }
  });
});

describe('what a container refuses to be written as', () => {
  it('refuses to write a project whose climate profile is not carried', async () => {
    const named = structuredClone(file);
    const incoherent = {
      ...named,
      project: {
        ...named.project,
        site: { northAngleDeg: 0, climateProfileId: 'brest' },
      },
    } as unknown as typeof file;
    // Discovering this on another machine, when the project no longer
    // calculates, is what the format exists to prevent.
    await expect(writeProjectContainer(incoherent, [])).rejects.toThrow(
      /brest/u,
    );
    await expect(
      writeProjectContainer(incoherent, [
        { id: 'paris', json: '{"id":"paris"}' },
      ]),
    ).rejects.toThrow(/brest/u);
  });

  it('writes it once the dataset it names travels with it', async () => {
    const named = structuredClone(file);
    const coherent = {
      ...named,
      project: {
        ...named.project,
        site: { northAngleDeg: 0, climateProfileId: 'brest' },
      },
    } as unknown as typeof file;
    const bytes = await writeProjectContainer(coherent, [
      { id: 'brest', json: dataset },
    ]);
    expect((await readProjectContainer(bytes)).status).toBe('OK');
  });

  it('accepts a dataset whose entry was renamed but which declares the profile', async () => {
    const named = structuredClone(file);
    const coherent = {
      ...named,
      project: {
        ...named.project,
        site: { northAngleDeg: 0, climateProfileId: 'brest' },
      },
    } as unknown as typeof file;
    // The identifier inside the file is what the project refers to.
    const bytes = await writeProjectContainer(coherent, [
      { id: 'météo-locale', json: dataset },
    ]);
    expect((await readProjectContainer(bytes)).status).toBe('OK');
  });
});

describe('what the archive reader refuses to expand', () => {
  it('refuses more entries than it accepts', async () => {
    const archive = await writeZip(
      Array.from({ length: 4 }, (_entry, index) => ({
        name: `file-${index}.txt`,
        data: new TextEncoder().encode('x'),
      })),
    );
    await expect(
      readZip(archive, { ...LIMITS, maxEntries: 3 }),
    ).rejects.toThrow(/entries/u);
  });

  it('refuses an archive larger than it accepts', async () => {
    const archive = await writeZip([
      { name: 'a.txt', data: new TextEncoder().encode('x'.repeat(100)) },
    ]);
    await expect(
      readZip(archive, { ...LIMITS, maxArchiveBytes: 10 }),
    ).rejects.toThrow(/MB/u);
  });

  it('refuses an entry that expands past the total it accepts', async () => {
    const archive = await writeZip([
      { name: 'a.txt', data: new TextEncoder().encode('x'.repeat(10_000)) },
    ]);
    await expect(
      readZip(archive, { ...LIMITS, maxTotalBytes: 100 }),
    ).rejects.toThrow();
  });

  it('refuses an entry that expands far more than it accepts', async () => {
    // Highly repetitive content compresses enormously: exactly the shape of an
    // archive built to fill memory.
    const archive = await writeZip([
      { name: 'a.txt', data: new TextEncoder().encode('x'.repeat(200_000)) },
    ]);
    await expect(
      readZip(archive, { ...LIMITS, maxCompressionRatio: 2 }),
    ).rejects.toThrow(/expands/u);
  });
});
