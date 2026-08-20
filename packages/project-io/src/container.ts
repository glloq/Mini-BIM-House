import type { ProjectFile } from '@house-technical-designer/core-domain';
import {
  loadProjectJson,
  serializeProjectFile,
  type ProjectLoadResult,
} from './project-io.js';
import type { MigrationJournalEntry } from './migrations.js';
import {
  looksLikeZip,
  readZip,
  writeZip,
  ZipFormatError,
  type ZipLimits,
} from './zip.js';

export const PROJECT_CONTAINER_FORMAT = 'house-technical-designer-container';
export const PROJECT_CONTAINER_VERSION = '1.0.0';

const PROJECT_ENTRY = 'project.json';
const MANIFEST_ENTRY = 'manifest.json';
const CLIMATE_PREFIX = 'climate/';
/** Container versions this application knows how to read. */
const SUPPORTED_VERSIONS = /^1\.\d+\.\d+$/u;

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
      /**
       * The migrations the project inside went through, if it came from an
       * older schema. A container opened silently upgraded would leave the
       * user with a file that is no longer the one they saved.
       */
      readonly migrationJournal: readonly MigrationJournalEntry[];
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

/** A container that cannot be written, with what is missing from it. */
export class ProjectContainerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectContainerError';
  }
}

/**
 * Whether these datasets carry the profile the project names.
 *
 * A dataset answers to its entry identifier or to the one written inside it;
 * both are accepted, because a file renamed on the way in is still the data the
 * project refers to.
 */
function carriesProfile(
  climate: readonly ContainedClimateDataset[],
  profile: string,
): boolean {
  return climate.some(
    ({ id, json }) => id === profile || carriesId(json, profile),
  );
}

/**
 * The project and its climate, as one file.
 *
 * A project that names a climate profile without carrying it is only half a
 * project: opened on another machine it recalculates nothing. The container
 * keeps them together, and stays a plain ZIP so anyone can look inside.
 *
 * The consistency is checked here as well as on the way in. A container written
 * without the weather its project names would be refused by every reader,
 * including this one — writing it and discovering that later, on another
 * machine, is the situation this format exists to prevent.
 */
export async function writeProjectContainer(
  file: ProjectFile,
  climate: readonly ContainedClimateDataset[] = [],
): Promise<Uint8Array> {
  const profile = file.project.site.climateProfileId;
  if (profile !== undefined && !carriesProfile(climate, profile))
    throw new ProjectContainerError(
      `The project uses the climate profile ${profile}; it has to be carried in the container, or the project must stop naming it.`,
    );
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

/** Whether a serialised dataset declares this identifier. */
function carriesId(json: string, id: string): boolean {
  try {
    return (JSON.parse(json) as { readonly id?: unknown }).id === id;
  } catch {
    return false;
  }
}

function stringify(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export interface ProjectContainerReadOptions {
  /**
   * Whether one carried dataset satisfies the climate contract.
   *
   * The reader does not know what a climate dataset is; the caller does. A
   * dataset that fails is a broken container, not a dataset to drop quietly.
   */
  readonly validateClimate?: (json: string) => boolean;
  readonly limits?: ZipLimits;
}

/** Reads a container, or says why these bytes are not one. */
export async function readProjectContainer(
  bytes: Uint8Array,
  options: ProjectContainerReadOptions = {},
): Promise<ProjectContainerResult> {
  if (!looksLikeZip(bytes)) return { status: 'NOT_A_CONTAINER' };
  let entries;
  try {
    entries = await readZip(bytes, options.limits);
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
  // A container written by a later version may hold things this one cannot
  // read; opening it half way would be worse than saying so.
  const version = manifest.version;
  if (typeof version !== 'string' || !SUPPORTED_VERSIONS.test(version))
    return {
      status: 'INVALID_CONTAINER',
      message: `This container is version ${String(version)}; this application reads ${PROJECT_CONTAINER_VERSION}.`,
    };
  if (typeof manifest.project !== 'string' || manifest.project === '')
    return {
      status: 'INVALID_CONTAINER',
      message: 'The container manifest names no project file.',
    };
  const projectBytes = byName.get(manifest.project);
  if (projectBytes === undefined)
    return {
      status: 'INVALID_CONTAINER',
      message: `The container declares ${manifest.project} but does not carry it.`,
    };
  const loaded = loadProjectJson(decoder.decode(projectBytes));
  if (loaded.status !== 'OK')
    return { status: 'INVALID_PROJECT', result: loaded };
  // Everything the manifest announces has to be there. A dataset listed and
  // missing would open as "loaded and validated" while the calculations quietly
  // lost the weather they were run on.
  //
  // A `climate` field that is not a list of names is a manifest this reader
  // does not understand. Reading it as "no climate" would turn a malformed
  // container into a valid one carrying nothing.
  const listed: unknown = manifest.climate;
  if (
    listed !== undefined &&
    (!Array.isArray(listed) ||
      !listed.every((entry) => typeof entry === 'string' && entry !== ''))
  )
    return {
      status: 'INVALID_CONTAINER',
      message: 'The container manifest does not list its climate entries.',
    };
  const declared: readonly string[] = (listed ?? []) as readonly string[];
  const climate: ContainedClimateDataset[] = [];
  for (const name of declared) {
    const data = byName.get(name);
    if (data === undefined)
      return {
        status: 'INVALID_CONTAINER',
        message: `The container declares ${name} and does not carry it.`,
      };
    const json = decoder.decode(data);
    try {
      JSON.parse(json);
    } catch {
      return {
        status: 'INVALID_CONTAINER',
        message: `The climate entry ${name} is not valid JSON.`,
      };
    }
    if (options.validateClimate?.(json) === false)
      return {
        status: 'INVALID_CONTAINER',
        message: `The climate entry ${name} does not satisfy the climate contract.`,
      };
    climate.push({
      id: name.startsWith(CLIMATE_PREFIX)
        ? name.slice(CLIMATE_PREFIX.length).replace(/\.json$/u, '')
        : name,
      json,
    });
  }
  // A container that carries weather but not the one the project names is
  // inconsistent with itself, and the modules would report the difference as a
  // missing input without anyone knowing why.
  //
  // A container carrying no weather at all is the case this used to let
  // through: the project said it was calculated on Brest, the archive held
  // nothing, and it opened as valid. An absent dataset is exactly as wrong as
  // the wrong dataset.
  const profile = loaded.file.project.site.climateProfileId;
  if (profile !== undefined && !carriesProfile(climate, profile))
    return {
      status: 'INVALID_CONTAINER',
      message: `The project uses the climate profile ${profile}, which this container does not carry.`,
    };
  return {
    status: 'OK',
    container: { file: loaded.file, climate },
    manifest,
    migrationJournal: loaded.migrationJournal,
  };
}
