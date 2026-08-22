/**
 * What is installed, written down so that something can disagree with it.
 *
 * A manifest is not documentation: it is the one place that says which
 * catalogue files exist, which registry each fills, how many entries it holds
 * and what it said when it was published. Without it, « the catalogue » is
 * whatever happens to be imported, and nobody can tell a release from a
 * working copy.
 *
 * Run with `--check`, it reports a manifest that no longer describes the data
 * instead of rewriting it, which is what the integration needs.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import process from 'node:process';
import { currentCatalogManifest } from '@house-technical-designer/catalog-registry';

const PATH = 'packages/catalog-registry/data/manifest.json';

const manifest = currentCatalogManifest();
const text = `${JSON.stringify(manifest, undefined, 2)}\n`;

if (process.argv.includes('--check')) {
  const held = existsSync(PATH) ? readFileSync(PATH, 'utf8') : '';
  if (held === text) {
    console.log(
      `✓ Manifeste à jour — ${manifest.generatedFrom.length} fichiers, publication ${manifest.releaseId}.`,
    );
    process.exit(0);
  }
  console.error(
    `✗ Le manifeste ne décrit plus les catalogues installés.\n  Lancer npm run catalog:manifest, puis relire la différence.`,
  );
  process.exit(1);
}

writeFileSync(PATH, text);
for (const entry of manifest.generatedFrom) {
  console.log(
    `  ${entry.registry.padEnd(16)} ${String(entry.entryCount).padStart(5)} entrées  ${entry.fingerprint}  ${entry.sources.length} fichier(s)`,
  );
  for (const source of entry.sources) console.log(`      ${source}`);
}
console.log(
  `\nPublication ${manifest.releaseId}, format ${manifest.catalogFormatVersion}, écrite dans ${PATH}.`,
);
