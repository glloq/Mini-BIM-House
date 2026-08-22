/**
 * One way of asking a catalogue « lequel ».
 *
 * Materials, assemblies, equipment and the five hundred families of the
 * nomenclature each had their own search box, their own filters and their own
 * idea of what a search matches. Four dialects of the same question is four
 * things to learn, and three of them will disagree the day one is corrected:
 * a search that ignores the manufacturer in one list and reads it in another
 * is a search nobody trusts.
 */

/** What a person is asking of a catalogue, whatever the catalogue holds. */
export interface CatalogQuery {
  /** Free text, matched against everything the entry says about itself. */
  readonly search?: string;
  /** The trade, when the catalogue sorts by trade. */
  readonly domain?: string;
  /** The family or category, when the catalogue sorts by family. */
  readonly family?: string;
  /** Whether to keep only the entries that are missing something. */
  readonly incompleteOnly?: boolean;
}

export interface CatalogCandidate {
  /** Everything the entry says about itself, in the order it says it. */
  readonly text: readonly (string | undefined)[];
  readonly domain?: string;
  readonly family?: string;
  readonly incomplete?: boolean;
}

/**
 * Compared without accents or case.
 *
 * Someone typing « beton » is looking for « béton », and a catalogue that
 * refuses is a catalogue people stop searching.
 */
export function plain(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/gu, '').toLowerCase().trim();
}

export function matchesQuery(
  candidate: CatalogCandidate,
  query: CatalogQuery,
): boolean {
  const wanted = plain(query.search ?? '');
  if (wanted !== '') {
    const haystack = candidate.text
      .filter((part): part is string => part !== undefined)
      .map(plain)
      .join(' ');
    // Every word, in any order: « cloison placo » finds « Cloison de
    // référence, plaque de plâtre » without anybody having to guess the order
    // the catalogue happens to write things in.
    if (!wanted.split(/\s+/u).every((word) => haystack.includes(word)))
      return false;
  }
  if (query.domain !== undefined && query.domain !== '')
    if (candidate.domain !== query.domain) return false;
  if (query.family !== undefined && query.family !== '')
    if (candidate.family !== query.family) return false;
  if (query.incompleteOnly === true && candidate.incomplete !== true)
    return false;
  return true;
}

/** The distinct values of one axis, in the order they were met. */
export function axisValues(
  candidates: readonly CatalogCandidate[],
  axis: 'domain' | 'family',
): readonly string[] {
  const seen: string[] = [];
  for (const candidate of candidates) {
    const value = candidate[axis];
    if (value !== undefined && !seen.includes(value)) seen.push(value);
  }
  return seen;
}
