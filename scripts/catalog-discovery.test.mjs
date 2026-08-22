import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The property this whole catalogue architecture exists for.
 *
 * *Adding a file of fiches must require no change to any TypeScript file.*
 *
 * It was not true until now: eight equipment files were imported by hand in
 * the loader and named one by one in the schema validator, so an agent could
 * write two hundred excellent fiches into
 * `data/equipment/heating/heat-pumps-02.json` and have none of them reach the
 * application, or any gate, until somebody remembered to edit two `.ts` files.
 * A catalogue meant to be filled by people who never open the code cannot work
 * that way.
 *
 * This test writes such a file, asks the real pipeline whether it can see it,
 * and removes it. Everything runs in a child process on purpose: the discovery
 * happens when the module graph is built, so a file created inside this
 * process would be invisible to a loader this process has already imported —
 * which is exactly the illusion that would make the test pass while the
 * property was false.
 */
const FIXTURE =
  'packages/equipment-catalog/data/equipment/heating/zz-discovery.json';

/** One entry the gate accepts, in a file nothing has ever been told about. */
const CONTENT = {
  definitions: [
    {
      id: 'discovery-probe-radiator',
      familyId: 'RADIATOR',
      name: 'Radiateur de découverte',
      version: '1.0.0',
      provenance: {
        type: 'GENERIC',
        reference: 'Fiche temporaire écrite par un test de découverte',
      },
      ports: [
        {
          id: 'flow',
          portTypeId: 'HEATING_FLOW',
          position: { x: 0, y: 0, z: 0 },
        },
        {
          id: 'return',
          portTypeId: 'HEATING_RETURN',
          position: { x: 100, y: 0, z: 0 },
        },
      ],
      properties: { nominalOutputW: 1000, exponent: 1.3 },
    },
  ],
};

function run(command, argv) {
  return execFileSync(command, argv, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NO_COLOR: '1' },
  });
}

describe('a file of fiches added without touching any TypeScript', () => {
  it('reaches the loader, the manifest, the index and the search', () => {
    const probe = path.join(
      mkdtempSync(path.join(tmpdir(), 'catalog-discovery-')),
      'probe.ts',
    );
    writeFileSync(
      probe,
      `import {
        rawGenericEquipmentEntries,
        equipmentCatalogSources,
      } from '@house-technical-designer/equipment-catalog';
      import {
        buildCatalogIndex,
        catalogSummaries,
        currentCatalogManifest,
        installedCatalog,
      } from '@house-technical-designer/catalog-registry';
      const manifest = currentCatalogManifest();
      const equipment = manifest.generatedFrom.find(
        (entry) => entry.registry === 'EQUIPMENT',
      );
      const repository = installedCatalog();
      console.log(
        JSON.stringify({
          sources: equipmentCatalogSources().filter((path) =>
            path.includes('zz-discovery'),
          ),
          loaded: rawGenericEquipmentEntries().some(
            (entry) => entry.id === 'discovery-probe-radiator',
          ),
          manifestCount: equipment?.entryCount ?? 0,
          manifestSources: equipment?.sources.length ?? 0,
          // What the loader itself holds, so the manifest can be compared to
          // it rather than to a number written here — which a filling wave
          // moves, and moving it is the one thing this test exists to forbid.
          loadedCount: rawGenericEquipmentEntries().length,
          loadedSources: equipmentCatalogSources().length,
          summarised: catalogSummaries().some(
            (entry) => entry.id === 'discovery-probe-radiator',
          ),
          found: buildCatalogIndex(catalogSummaries())
            .find({ text: 'découverte' })
            .map((entry) => entry.id),
          body: repository.summaries.some(
            (entry) => entry.id === 'discovery-probe-radiator',
          ),
        }),
      );`,
    );

    let output;
    try {
      writeFileSync(FIXTURE, `${JSON.stringify(CONTENT, undefined, 2)}\n`);
      // The schema validator scans the tree too: a file it does not see is a
      // file nobody checks, which is worse than one nobody loads.
      const validated = run('npx', [
        'vite-node',
        'scripts/validate-schemas.mjs',
      ]);
      expect(validated).toContain('zz-discovery.json');
      output = JSON.parse(run('npx', ['vite-node', probe]).trim());
    } finally {
      rmSync(FIXTURE, { force: true });
      rmSync(path.dirname(probe), { recursive: true, force: true });
    }

    expect(output.sources).toEqual([FIXTURE]);
    expect(output.loaded).toBe(true);
    // The manifest says what is installed: every fiche the loader holds, from
    // every file it found, the new one included.
    expect(output.manifestCount).toBe(output.loadedCount);
    expect(output.manifestSources).toBe(output.loadedSources);
    expect(output.manifestSources).toBeGreaterThan(1);
    expect(output.summarised).toBe(true);
    expect(output.body).toBe(true);
    expect(output.found).toContain('discovery-probe-radiator');
  }, 120_000);
});
