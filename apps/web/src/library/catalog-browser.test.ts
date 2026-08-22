import { describe, expect, it } from 'vitest';
import { SYMBOL_LIBRARY_V1 } from '@house-technical-designer/drawing-engine';
import {
  catalogEvidence,
  installedCatalog,
  type CatalogSummary,
} from '@house-technical-designer/catalog-registry';
import {
  CATALOG_DOMAINS,
  catalogFamilyView,
  catalogRows,
} from './catalog-browser.js';

// Rows, not fiches: the panel draws a name and a version, and used to be
// handed whole catalogue entries to do it.
const repository = installedCatalog();
const entriesByFamily: Record<string, CatalogSummary[]> = {};
for (const summary of repository.index.byRegistry.get('EQUIPMENT') ?? [])
  if (summary.familyId !== undefined)
    (entriesByFamily[summary.familyId] ??= []).push(summary);
const known = {
  symbols: new Set(Object.keys(SYMBOL_LIBRARY_V1.definitions)),
  entries: [],
  evidence: catalogEvidence(repository.summaries),
};

describe('browsing the nomenclature', () => {
  it('offers the whole of it, not the nineteen entries somebody wrote', () => {
    // The panel listed nineteen while the rest of the application had been
    // checking five hundred and twenty for weeks.
    expect(catalogRows(entriesByFamily, known).length).toBe(520);
  });

  it('narrows by trade, by wave and by word', () => {
    const heating = catalogRows(entriesByFamily, known, { domain: 'HEATING' });
    expect(heating.length).toBeGreaterThan(0);
    expect(heating.every(({ domain }) => domain === 'HEATING')).toBe(true);
    expect(
      catalogRows(entriesByFamily, known, { wave: 4 }).every(
        ({ wave }) => wave === 4,
      ),
    ).toBe(true);
    const searched = catalogRows(entriesByFamily, known, { search: 'pompe' });
    expect(searched.length).toBeGreaterThan(0);
    expect(
      searched.every(({ label }) => label.toLowerCase().includes('pompe')),
    ).toBe(true);
  });

  it('answers « what can I actually place today »', () => {
    const placeable = catalogRows(entriesByFamily, known, {
      withGenericData: true,
    });
    expect(placeable.length).toBe(19);
    expect(placeable.every(({ entryCount }) => entryCount > 0)).toBe(true);
  });

  it('puts what is furthest along first', () => {
    const rows = catalogRows(entriesByFamily, known);
    const scores = rows.map(({ progress }) => progress);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('says what a family is, not only what it is called', () => {
    const view = catalogFamilyView(
      'HEAT_PUMP_AIR_WATER_MONOBLOC',
      entriesByFamily,
      known,
    )!;
    expect(view.ports).toContain('Départ chauffage');
    expect(view.optionalPorts.length).toBeGreaterThan(0);
    expect(view.hosts).toContain('Dalle');
    expect(view.clearances).toContain('Prise d’air');
    expect(view.calculators).toContain('heating');
    expect(view.properties.some(({ unit }) => unit !== undefined)).toBe(true);
    expect(view.entries.map(({ id }) => id)).toEqual([
      'generic-air-water-heat-pump',
    ]);
  });

  it('says plainly when a family has nothing to place', () => {
    // Nothing anywhere: no fiche of it in any of the six registries.
    const view = catalogFamilyView('EAVE', entriesByFamily, known)!;
    expect(view.entries).toEqual([]);
    expect(view.axes.find(({ axis }) => axis === 'GENERIC_DATA')?.value).toBe(
      'NONE',
    );
  });

  it('separates « nothing exists » from « nothing to place here »', () => {
    // A flue pipe family holds six catalogued products, so it has generic
    // data; it holds no equipment, so this panel has nothing to offer from it.
    // The evidence now counts all six registries, where it used to count the
    // equipment catalogue alone and call the rest empty.
    const view = catalogFamilyView('FLUE_PIPE', entriesByFamily, known)!;
    expect(view.entries).toEqual([]);
    expect(view.axes.find(({ axis }) => axis === 'GENERIC_DATA')?.value).toBe(
      'READY',
    );
  });

  it('offers only the trades that hold families', () => {
    expect(CATALOG_DOMAINS.length).toBeGreaterThan(5);
    expect(CATALOG_DOMAINS.map(({ id }) => id)).toContain('PLUMBING');
  });
});
