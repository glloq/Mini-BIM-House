import type {
  DataDomain,
  DataRegistry,
} from '@house-technical-designer/technical-types';
import type { CatalogCapability } from './capabilities.js';
import type { CatalogLifecycle } from './catalog-identity.js';
import {
  formatCatalogRef,
  type CatalogRef,
} from '@house-technical-designer/technical-types';

/**
 * One catalogue entry, reduced to what a list needs to show it.
 *
 * The interface asked the catalogue for whole entries in order to draw a row:
 * the name, the family and the version, out of an object carrying its ports,
 * its clearances, its performance maps and every figure it states. Nineteen
 * entries make that invisible. Ten thousand make it the reason the panel takes
 * four seconds to open, on every keystroke of the search box.
 *
 * A summary is the row. The body is fetched when somebody actually opens one.
 */
export interface CatalogSummary {
  readonly ref: CatalogRef;
  readonly registry: DataRegistry;
  readonly id: string;
  readonly version: string;
  readonly label: string;
  readonly familyId?: string;
  readonly category?: string;
  readonly domain?: DataDomain;
  readonly lifecycle: CatalogLifecycle;
  readonly capabilities: readonly CatalogCapability[];
  readonly manufacturer?: string;
  /**
   * Whether this entry passes the gate its family sets.
   *
   * Carried on the row rather than recomputed by whoever draws it. The
   * interface needs to know « can I place one of these today », and answering
   * it used to mean validating every entry of every family on every render —
   * invisible at nineteen entries, four seconds at ten thousand. Whoever
   * builds the summaries knows the answer already: the bundled repository
   * because it ran the gate, a server because it ran it before shipping them.
   */
  readonly valid: boolean;
}

/**
 * What a search box compares.
 *
 * Accents folded and case dropped, so that « fenêtre » finds `Fenetre` and
 * `FENÊTRE` alike — a French catalogue searched by exact string is a catalogue
 * whose search box works for whoever typed the entry.
 */
export function foldForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr');
}

export interface CatalogQuery {
  readonly text?: string;
  readonly registries?: readonly DataRegistry[];
  readonly families?: readonly string[];
  readonly categories?: readonly string[];
  readonly domains?: readonly DataDomain[];
  readonly capabilities?: readonly CatalogCapability[];
  /** By default only what may still be offered; pass true to see everything. */
  readonly includeRetired?: boolean;
}

/**
 * Every summary the installed catalogues hold, arranged so a question is
 * answered without walking all of them.
 *
 * Five maps and a folded-text field, built once. A panel filtering by trade and
 * capability over ten thousand entries then costs a lookup rather than ten
 * thousand comparisons per keystroke.
 */
export interface CatalogIndex {
  readonly all: readonly CatalogSummary[];
  readonly byRef: ReadonlyMap<string, CatalogSummary>;
  readonly byRegistry: ReadonlyMap<DataRegistry, readonly CatalogSummary[]>;
  readonly byFamily: ReadonlyMap<string, readonly CatalogSummary[]>;
  readonly byCategory: ReadonlyMap<string, readonly CatalogSummary[]>;
  readonly byCapability: ReadonlyMap<
    CatalogCapability,
    readonly CatalogSummary[]
  >;
  readonly find: (query: CatalogQuery) => readonly CatalogSummary[];
}

function push<K>(
  into: Map<K, CatalogSummary[]>,
  key: K,
  value: CatalogSummary,
): void {
  const held = into.get(key);
  if (held === undefined) into.set(key, [value]);
  else held.push(value);
}

export function buildCatalogIndex(
  summaries: readonly CatalogSummary[],
): CatalogIndex {
  const byRef = new Map<string, CatalogSummary>();
  const byRegistry = new Map<DataRegistry, CatalogSummary[]>();
  const byFamily = new Map<string, CatalogSummary[]>();
  const byCategory = new Map<string, CatalogSummary[]>();
  const byCapability = new Map<CatalogCapability, CatalogSummary[]>();
  const folded = new Map<string, string>();
  for (const summary of summaries) {
    byRef.set(formatCatalogRef(summary.ref), summary);
    push(byRegistry, summary.registry, summary);
    if (summary.familyId !== undefined)
      push(byFamily, summary.familyId, summary);
    if (summary.category !== undefined)
      push(byCategory, summary.category, summary);
    for (const capability of summary.capabilities)
      push(byCapability, capability, summary);
    folded.set(
      summary.id,
      foldForSearch(
        [
          summary.label,
          summary.id,
          summary.familyId ?? '',
          summary.manufacturer ?? '',
        ].join(' '),
      ),
    );
  }

  const find = (query: CatalogQuery): readonly CatalogSummary[] => {
    const text = query.text === undefined ? '' : foldForSearch(query.text);
    const registries =
      query.registries === undefined ? undefined : new Set(query.registries);
    const families =
      query.families === undefined ? undefined : new Set(query.families);
    const categories =
      query.categories === undefined ? undefined : new Set(query.categories);
    const domains =
      query.domains === undefined ? undefined : new Set(query.domains);
    return summaries.filter((summary) => {
      // A retired entry keeps opening the files that hold it and stops being
      // offered to somebody starting a design. The two are different questions
      // and used to be one string.
      if (query.includeRetired !== true && summary.lifecycle !== 'ACTIVE')
        return false;
      if (registries !== undefined && !registries.has(summary.registry))
        return false;
      if (
        families !== undefined &&
        (summary.familyId === undefined || !families.has(summary.familyId))
      )
        return false;
      if (
        categories !== undefined &&
        (summary.category === undefined || !categories.has(summary.category))
      )
        return false;
      if (
        domains !== undefined &&
        (summary.domain === undefined || !domains.has(summary.domain))
      )
        return false;
      if (
        query.capabilities !== undefined &&
        !query.capabilities.every((capability) =>
          summary.capabilities.includes(capability),
        )
      )
        return false;
      return text === '' || (folded.get(summary.id) ?? '').includes(text);
    });
  };

  return {
    all: summaries,
    byRef,
    byRegistry,
    byFamily,
    byCategory,
    byCapability,
    find,
  };
}
