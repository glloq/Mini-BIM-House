import { describe, expect, it } from 'vitest';
import { SYMBOL_LIBRARY_V1 } from '@house-technical-designer/drawing-engine';
import {
  buildCatalogIndex,
  catalogEvidence,
  syntheticSummaries,
  type CatalogSummary,
} from '@house-technical-designer/catalog-registry';
import { catalogFamilyView, catalogRows } from './catalog-browser.js';

/**
 * The path a person actually takes, at the size the catalogue is meant to
 * reach.
 *
 * The benchmark measures the index; it does not measure the panel. And the
 * panel was the half that did not scale: it asked the catalogue for every
 * entry — ports, clearances, performance maps, every figure — in order to draw
 * a list of names, then rebuilt that grouping on every keystroke of the search
 * box. Invisible at nineteen entries; four seconds at ten thousand.
 *
 * What this asserts is not a duration, which would differ by machine and go
 * flaky. It is the shape: the rows the panel holds are summaries, the counts
 * it shows come from two numbers per family rather than from walking the
 * fiches, and neither the list nor the opened family ever touches a body.
 */
const TEN_THOUSAND = syntheticSummaries(10_000);

function grouped(
  summaries: readonly CatalogSummary[],
): Record<string, CatalogSummary[]> {
  const groups: Record<string, CatalogSummary[]> = {};
  for (const summary of summaries)
    if (summary.familyId !== undefined)
      (groups[summary.familyId] ??= []).push(summary);
  return groups;
}

const byFamily = grouped(TEN_THOUSAND);
const known = {
  symbols: new Set(Object.keys(SYMBOL_LIBRARY_V1.definitions)),
  entries: [],
  evidence: catalogEvidence(TEN_THOUSAND),
};

describe('the catalogue panel with ten thousand entries behind it', () => {
  it('draws every row of the nomenclature without holding a fiche', () => {
    const rows = catalogRows(byFamily, known);
    expect(rows.length).toBe(520);
    const counted = rows.reduce((total, row) => total + row.entryCount, 0);
    expect(counted).toBe(10_000);
    for (const row of rows.slice(0, 20)) {
      expect(row.progress).toBeGreaterThan(0);
      expect(row.progress).toBeLessThanOrEqual(1);
    }
  });

  it('narrows by word, by trade and by « what can I place » over all of them', () => {
    expect(
      catalogRows(byFamily, known, { search: 'compact' }).length,
    ).toBeGreaterThan(0);
    const placeable = catalogRows(byFamily, known, { withGenericData: true });
    expect(placeable.length).toBeGreaterThan(300);
    expect(placeable.every(({ entryCount }) => entryCount > 0)).toBe(true);
    const heating = catalogRows(byFamily, known, { domain: 'HEATING' });
    expect(heating.every(({ domain }) => domain === 'HEATING')).toBe(true);
  });

  it('opens one family and shows its rows, not its fiches', () => {
    const view = catalogFamilyView('RADIATOR', byFamily, known)!;
    expect(view.entries.length).toBeGreaterThan(10);
    for (const entry of view.entries) {
      expect(entry.label).not.toBe('');
      // A row carries what a row shows. The body — ports, clearances, curves,
      // every figure — is fetched from the repository when somebody places
      // one, and never in order to draw a list.
      expect(entry).not.toHaveProperty('properties');
      expect(entry).not.toHaveProperty('ports');
      expect(entry).not.toHaveProperty('performanceCurves');
    }
  });

  it('counts a family from two numbers rather than from ten thousand fiches', () => {
    const evidence = catalogEvidence(TEN_THOUSAND);
    const radiators = byFamily.RADIATOR ?? [];
    expect(evidence.get('RADIATOR')).toEqual({
      entryCount: radiators.length,
      cleanCount: radiators.filter(({ valid }) => valid).length,
    });
    // And the index agrees with a full scan, or the maps are a faster way of
    // being wrong.
    expect(buildCatalogIndex(TEN_THOUSAND).byFamily.get('RADIATOR')).toEqual(
      radiators,
    );
  });
});
