import type { ProjectFile } from '@house-technical-designer/core-domain';
import {
  loadProjectJson,
  serializeProjectFile,
  type ProjectLoadResult,
} from './project-io.js';
import { looksLikeZip, readZip, writeZip, ZipFormatError } from './zip.js';

export const PROJECT_CONTAINER_FORMAT = 'house-technical-designer-container';
export const PROJECT_CONTAINER_VERSION = '1.0.0';

const PROJECT_ENTRY = 'project.json';
const MANIFEST_ENTRY = 'manifest.json';
const CLIMATE_PREFIX = 'climate/';

/**
 * What a container declares about itself.
 *
 * A reader must be able to tell what it holds before opening anything, and a
 * human unzipping it must be able to read the same thing.
 */
export interface ProjectContainerManifest {
  readonly format: typeof PROJECT_CONTAINER_FORMAT;
  readonly version: string;
  readonly applicationVersion?: string;
  readonly project: string;
  readonly climate: readonly string[];
}

/** A dataset carried beside the project, as it was given to the application. */
export interface ContainedClimateDataset {
  readonly id: string;
  readonly json: string;
}

export interface ProjectContainer {
  readonly file: ProjectFile;
  readonly climate: readonly ContainedClimateDataset[];
}

export type ProjectContainerResult =
  | {
      readonly status: 'OK';
      readonly container: ProjectContainer;
      readonly manifest: ProjectContainerManifest;
    }
  | { readonly status: 'NOT_A_CONTAINER' }
  | { readonly status: 'INVALID_CONTAINER'; readonly message: string }
  | {
      readonly status: 'INVALID_PROJECT';
      readonly result: ProjectLoadResult;
    };

function safeEntryName(id: string): string {
  const stem = id.replace(/[^a-zA-Z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '');
  return stem === '' ? 'dataset' : stem;
}

/**
 * The project and its climate, as one file.
 *
 * A project that names a climate profile without carrying it is only half a
 * project: opened on another machine it recalculates nothing. The container
 * keeps them together, and stays a plain ZIP so anyone can look inside.
 */
export async function writeProjectContainer(
  file: ProjectFile,
  climate: readonly ContainedClimateDataset[] = [],
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const used = new Set<string>();
  const entries = climate.map((dataset) => {
    let name = safeEntryName(dataset.id);
    let suffix = 2;
    while (used.has(name)) name = `${safeEntryName(dataset.id)}-${suffix++}`;
    used.add(name);
    return { name: `${CLIMATE_PREFIX}${name}.json`, json: dataset.json };
  });
  const manifest: ProjectContainerManifest = {
    format: PROJECT_CONTAINER_FORMAT,
    version: PROJECT_CONTAINER_VERSION,
    ...(file.applicationVersion === undefined
      ? {}
      : { applicationVersion: file.applicationVersion }),
    project: PROJECT_ENTRY,
    climate: entries.map(({ name }) => name),
  };
  return writeZip([
    { name: MANIFEST_ENTRY, data: encoder.encode(stringify(manifest)) },
    // Serialising validates: a container never carries a project the plain
    // format would have refused to write.
    { name: PROJECT_ENTRY, data: encoder.encode(serializeProjectFile(file)) },
    ...entries.map((entry) => ({
      name: entry.name,
      data: encoder.encode(entry.json),
    })),
  ]);
}

function stringify(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Reads a container, or says why these bytes are not one. */
export async function readProjectContainer(
  bytes: Uint8Array,
): Promise<ProjectContainerResult> {
  if (!looksLikeZip(bytes)) return { status: 'NOT_A_CONTAINER' };
  let entries;
  try {
    entries = await readZip(bytes);
  } catch (error: unknown) {
    return {
      status: 'INVALID_CONTAINER',
      message:
        error instanceof ZipFormatError
          ? error.message
          : 'This archive could not be read.',
    };
  }
  const decoder = new TextDecoder();
  const byName = new Map(entries.map((entry) => [entry.name, entry.data]));
  const manifestBytes = byName.get(MANIFEST_ENTRY);
  if (manifestBytes === undefined)
    return {
      status: 'INVALID_CONTAINER',
      message: `This archive carries no ${MANIFEST_ENTRY}, so it is not a project container.`,
    };
  let manifest: ProjectContainerManifest;
  try {
    manifest = JSON.parse(
      decoder.decode(manifestBytes),
    ) as ProjectContainerManifest;
  } catch {
    return {
      status: 'INVALID_CONTAINER',
      message: 'The container manifest is not valid JSON.',
    };
  }
  if (manifest.format !== PROJECT_CONTAINER_FORMAT)
    return {
      status: 'INVALID_CONTAINER',
      message: 'The container manifest declares another format.',
    };
  const projectBytes = byName.get(manifest.project ?? PROJECT_ENTRY);
  if (projectBytes === undefined)
    return {
      status: 'INVALID_CONTAINER',
      message: `The container declares ${manifest.project} but does not carry it.`,
    };
  const loaded = loadProjectJson(decoder.decode(projectBytes));
  if (loaded.status !== 'OK')
    return { status: 'INVALID_PROJECT', result: loaded };
  const climate = (manifest.climate ?? [])
    .map((name) => {
      const data = byName.get(name);
      return data === undefined
        ? undefined
        : {
            id: name.slice(CLIMATE_PREFIX.length).replace(/\.json$/u, ''),
            json: decoder.decode(data),
          };
    })
    .filter((entry): entry is ContainedClimateDataset => entry !== undefined);
  return {
    status: 'OK',
    container: { file: loaded.file, climate },
    manifest,
  };
}
