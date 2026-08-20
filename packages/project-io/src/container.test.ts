import { describe, expect, it } from 'vitest';
import type { ProjectFile } from '@house-technical-designer/core-domain';
import {
  PROJECT_CONTAINER_FORMAT,
  readProjectContainer,
  writeProjectContainer,
} from './container.js';
import { crc32, looksLikeZip, readZip, writeZip } from './zip.js';

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
