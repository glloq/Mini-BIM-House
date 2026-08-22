import { describe, expect, it } from 'vitest';
import {
  buildCatalogIndex,
  catalogManifestEntries,
  catalogSummaries,
  currentCatalogManifest,
  foldForSearch,
  formatCatalogRef,
  familiesExercisedBy,
  installedCatalog,
  lazyCatalogRepository,
  measuredStatus,
  validateCatalog,
  type CatalogSummary,
} from './index.js';

describe('what is installed, said once', () => {
  it('names every catalogue file, its registry and what it holds', () => {
    const entries = catalogManifestEntries();
    expect(entries.map(({ registry }) => registry)).toEqual([
      'EQUIPMENT',
      'MATERIAL',
      'OPENING',
      'ASSEMBLY',
      'NETWORK_PRODUCT',
      'SYMBOL',
    ]);
    for (const entry of entries) {
      expect(entry.entryCount).toBeGreaterThan(0);
      expect(entry.fingerprint).toMatch(/^[0-9a-f]{16}$/u);
      expect(entry.formatVersion).toMatch(/^\d+\.\d+\.\d+$/u);
    }
  });

  it('keeps the two version levels apart', () => {
    // One says whether this application can read the files at all and changes
    // when the shape does; the other says which batch of data this is and
    // changes whenever an entry is added. Conflating them meant either bumping
    // a breaking version for a typo or never bumping anything.
    const manifest = currentCatalogManifest();
    expect(manifest.catalogFormatVersion).toBe('1.0.0');
    expect(manifest.releaseId).toMatch(/^[0-9a-f]{16}$/u);
    expect(manifest.releaseId).not.toBe(manifest.catalogFormatVersion);
  });

  it('derives the release from the data rather than from a promise', () => {
    // A number somebody has to remember to raise is a number that will
    // disagree with the data it names.
    expect(currentCatalogManifest().releaseId).toBe(
      currentCatalogManifest().releaseId,
    );
  });
});

describe('the catalogue as rows, before it is the catalogue as entries', () => {
  it('summarises all six registries into one list', () => {
    const summaries = catalogSummaries();
    expect(new Set(summaries.map(({ registry }) => registry)).size).toBe(6);
    expect(summaries.length).toBe(19 + 16 + 12 + 7 + 66 + 27);
    for (const summary of summaries) {
      expect(summary.label).not.toBe('');
      expect(summary.version).toMatch(/^\d+\.\d+\.\d+$/u);
    }
  });

  it('carries what a row shows and not what an entry holds', () => {
    const pump = catalogSummaries().find(
      ({ id }) => id === 'generic-air-water-heat-pump',
    )!;
    expect(pump.domain).toBe('HEATING');
    expect(pump.category).toBe('HEAT_PUMP');
    expect(pump.capabilities).toContain('PERFORMANCE_MAPPED');
    expect(pump).not.toHaveProperty('properties');
    expect(pump).not.toHaveProperty('performanceCurves');
  });

  it('finds a French name however it was typed', () => {
    expect(foldForSearch('Fenêtre à la française')).toBe(
      'fenetre a la francaise',
    );
    const index = buildCatalogIndex(catalogSummaries());
    expect(index.find({ text: 'FENETRE' }).map(({ id }) => id)).toContain(
      'generic-window-casement-double',
    );
    expect(index.find({ text: 'fenêtre' }).length).toBeGreaterThan(2);
  });

  it('answers a filtered question from a map rather than a scan', () => {
    const index = buildCatalogIndex(catalogSummaries());
    expect(index.byRegistry.get('SYMBOL')).toHaveLength(27);
    expect(index.byFamily.get('WINDOW_CASEMENT')).toHaveLength(1);
    expect(index.byCategory.get('INSULATION')).toHaveLength(6);
    expect(index.byCapability.get('RUN_MATERIAL')?.length).toBe(66);
    expect(
      index.find({ registries: ['MATERIAL'], categories: ['METAL'] }).length,
    ).toBe(2);
    expect(index.find({ capabilities: ['PERFORMANCE_MAPPED'] }).length).toBe(3);
  });

  it('offers what is in service and can be asked for the rest', () => {
    const summaries: readonly CatalogSummary[] = [
      {
        ref: { registry: 'MATERIAL', id: 'gone', version: '1.0.0' },
        registry: 'MATERIAL',
        id: 'gone',
        version: '1.0.0',
        label: 'Retiré',
        lifecycle: 'WITHDRAWN',
        capabilities: [],
      },
    ];
    const index = buildCatalogIndex(summaries);
    expect(index.find({})).toEqual([]);
    expect(index.find({ includeRetired: true })).toHaveLength(1);
  });
});

describe('where the catalogues come from', () => {
  it('gives the whole of one entry when somebody opens it', async () => {
    const repository = installedCatalog();
    const found = repository.summaries.find(
      ({ id }) => id === 'generic-rock-wool',
    )!;
    const body = (await repository.entry(found.ref)) as {
      readonly properties: Record<string, number>;
    };
    expect(body.properties.thermalConductivity).toBeGreaterThan(0);
    expect(await repository.entry({ ...found.ref, version: '9.9.9' })).toBe(
      undefined,
    );
  });

  it('fetches a registry once, and never for a reference it does not list', async () => {
    let fetched = 0;
    const summaries = catalogSummaries().filter(
      ({ registry }) => registry === 'OPENING',
    );
    const repository = lazyCatalogRepository(
      currentCatalogManifest(),
      summaries,
      async (registry) => {
        fetched += 1;
        return new Map(
          summaries
            .filter((summary) => summary.registry === registry)
            .map((summary) => [
              formatCatalogRef(summary.ref),
              { id: summary.id },
            ]),
        );
      },
    );
    await repository.entry(summaries[0]!.ref);
    await repository.entry(summaries[1]!.ref);
    expect(fetched).toBe(1);
    // A typo must not pull a whole registry over the wire to find out.
    expect(
      await repository.entry({
        registry: 'EQUIPMENT',
        id: 'nothing',
        version: '1.0.0',
      }),
    ).toBeUndefined();
    expect(fetched).toBe(1);
  });
});

describe('what the version gate covers, and what it says is proven', () => {
  const entries = [
    {
      id: 'generic-nothing',
      familyId: 'RADIATOR',
      version: '1.0.0',
      properties: {},
    },
  ];

  it('refuses an entry no fingerprint covers', () => {
    // It used to pass in silence, so the mechanism protected only the entries
    // somebody had remembered to stamp — and ten thousand new ones would have
    // been ten thousand entries outside it.
    expect(
      validateCatalog(entries, new Set(), {}).map(({ message }) => message),
    ).toContain(
      'is not recorded: generic-nothing@1.0.0 has no fingerprint. Run npm run catalog:fingerprints.',
    );
  });

  it('refuses a fingerprint no entry claims', () => {
    // The next entry to take that identifier would inherit it.
    expect(
      validateCatalog([], new Set(), { 'generic-gone@1.0.0': 'abcd' }).map(
        ({ message }) => message,
      ),
    ).toEqual([
      'is recorded and no entry claims it. Run npm run catalog:fingerprints.',
    ]);
  });

  it('calls a family tested only when a fixture is made of it', () => {
    // `TESTS` was set from « a catalogue entry of this family passes the
    // gate », which is what GENERIC_DATA already says: the same measurement
    // wearing a stronger word.
    const known = { symbols: new Set<string>(), entries: [] };
    expect(measuredStatus('RADIATOR', known).TESTS).toBe('NONE');
    expect(
      measuredStatus('RADIATOR', {
        ...known,
        exercised: new Set(['RADIATOR']),
      }).TESTS,
    ).toBe('VALIDATED');
  });

  it('reads what a project is made of, and does not guess the rest', () => {
    expect(
      familiesExercisedBy({
        equipment: [{ familyId: 'RADIATOR' }, {}],
        openingTypes: [{ familyId: 'WINDOW_CASEMENT' }],
        networkProducts: [{ family: 'WATER_PIPE' }],
      }),
    ).toEqual(new Set(['RADIATOR', 'WINDOW_CASEMENT', 'WATER_PIPE']));
    expect(familiesExercisedBy({})).toEqual(new Set());
  });
});
