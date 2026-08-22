import type { DataRegistry } from '@house-technical-designer/technical-types';
import type { CatalogRef } from './catalog-identity.js';
import { formatCatalogRef } from './catalog-identity.js';
import type { CatalogIndex, CatalogSummary } from './catalog-index.js';
import { buildCatalogIndex } from './catalog-index.js';

/**
 * What one catalogue file says about itself, without being read.
 *
 * A manifest entry is not a summary of the entries: it is a statement about
 * the *file* — which registry it fills, how many entries it holds, what shape
 * it is written in, and what it said when it was published. That is what lets
 * a loader decide whether to fetch it at all, and a gate notice that a file
 * has changed since the release that claims to contain it.
 */
export interface CatalogManifestEntry {
  readonly registry: DataRegistry;
  /** Where the file lives, relative to the repository root. */
  readonly path: string;
  readonly entryCount: number;
  /** The shape the file is written in, which changes far less than its content. */
  readonly formatVersion: string;
  /** What the whole set said when the manifest was generated. */
  readonly fingerprint: string;
}

/**
 * Everything installed, and which release it is.
 *
 * Two version levels, because they answer different questions. A
 * `catalogFormatVersion` says whether this application can read the files at
 * all — it changes when the shape changes, which is rare and breaking. A
 * `releaseId` says which batch of data this is — it changes every time an
 * entry is added, which is constant and harmless. Conflating them meant either
 * bumping a breaking version for a typo, or never bumping anything.
 */
export interface CatalogManifest {
  readonly catalogFormatVersion: string;
  readonly releaseId: string;
  readonly generatedFrom: readonly CatalogManifestEntry[];
}

/**
 * The shape of « where the catalogues come from ».
 *
 * Everything today reads a JSON file bundled into the application, and at ten
 * thousand entries it will not: the summaries will be fetched and the bodies
 * fetched one at a time, or built from a database, or read from a folder a
 * user pointed at. What must not change on that day is the code that asks.
 *
 * So the question is stated here, once: what is installed, what does it hold,
 * and give me this one entry. Whether the answer costs a property access or a
 * network round trip is the repository's business, which is why `entry` is a
 * promise and `summaries` is not — a list is drawn now, a body is opened
 * later.
 */
export interface CatalogRepository {
  readonly manifest: CatalogManifest;
  readonly summaries: readonly CatalogSummary[];
  readonly index: CatalogIndex;
  /** The whole of one entry, fetched when somebody actually opens it. */
  readonly entry: (ref: CatalogRef) => Promise<unknown>;
}

/**
 * A repository over catalogues already in memory.
 *
 * The one the application uses today: the files are bundled, so the body of an
 * entry costs a map lookup and the promise resolves at once. It exists so that
 * nothing calling it has to know that — the day the bodies are fetched, only
 * this file changes.
 */
export function bundledCatalogRepository(
  manifest: CatalogManifest,
  summaries: readonly CatalogSummary[],
  bodies: ReadonlyMap<string, unknown>,
): CatalogRepository {
  return {
    manifest,
    summaries,
    index: buildCatalogIndex(summaries),
    entry: (ref) => Promise.resolve(bodies.get(formatCatalogRef(ref))),
  };
}

/**
 * A repository that fetches a registry's entries the first time one is asked
 * for, and remembers them.
 *
 * The shape the day the catalogue outgrows the bundle. It is here now, with a
 * test, rather than later in a hurry: a lazy repository designed after ten
 * thousand entries have arrived is designed against a deadline.
 */
export function lazyCatalogRepository(
  manifest: CatalogManifest,
  summaries: readonly CatalogSummary[],
  load: (registry: DataRegistry) => Promise<ReadonlyMap<string, unknown>>,
): CatalogRepository {
  const loaded = new Map<DataRegistry, Promise<ReadonlyMap<string, unknown>>>();
  const byRef = new Map(
    summaries.map((summary) => [
      formatCatalogRef(summary.ref),
      summary.registry,
    ]),
  );
  return {
    manifest,
    summaries,
    index: buildCatalogIndex(summaries),
    entry: async (ref) => {
      const key = formatCatalogRef(ref);
      const registry = byRef.get(key);
      // Nothing is fetched for a reference the manifest does not list: a
      // typo would otherwise pull a whole registry over the wire to find out.
      if (registry === undefined) return undefined;
      let pending = loaded.get(registry);
      if (pending === undefined) {
        pending = load(registry);
        loaded.set(registry, pending);
      }
      return (await pending).get(key);
    },
  };
}
