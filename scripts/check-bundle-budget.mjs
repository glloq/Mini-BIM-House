import { gzipSync } from 'node:zlib';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

/**
 * Keeps the download the first visit pays for from growing unnoticed.
 *
 * The number that matters is what the browser must fetch before the
 * application appears — the page, its stylesheet and the modules it names —
 * compressed, since that is how it travels. Workspaces loaded on demand are
 * counted apart: they are what makes it possible to keep the first payload
 * small, and they must not be charged for it.
 *
 * A budget is a decision, not a measurement. Raising one is allowed; doing it
 * without noticing is not.
 */
export const BUDGETS = {
  /**
   * Page, stylesheet and the modules it references, gzipped.
   *
   * Raised from 200 kio when the editor gained the families and tools of the
   * ninth audit's lots C to H: walls drawn as runs, rooms, slabs, openings in
   * slabs, stairs, roofs described by their outline, placed components,
   * structure, the site, the graphical network editor and scenario mode. All
   * of it is the editor, which is what the first visit loads; the workspaces
   * behind it stay on demand, and the PDF chain was moved there.
   *
   * Raised again from 240 kio for the integrity work of the eleventh audit:
   * the index of what points at what, which every deletion asks before it
   * removes anything, and the clearance volumes the plan draws. Both are the
   * editor answering questions about the project on screen, so both are loaded
   * with it; what could wait — the nomenclature of five hundred families, the
   * catalogue browser, the checks — is still on demand.
   *
   * A budget is a decision, not a measurement. This one was taken knowingly.
   */
  initialGzipBytes: 248 * 1024,
  /** Everything the build produces, gzipped. */
  totalGzipBytes: 360 * 1024,
};

/** The assets an HTML page loads before anything runs. */
export function initialReferences(html) {
  const references = new Set();
  const pattern = /<(?:script|link)\b[^>]*?\b(?:src|href)="\.?\/?([^"]+)"/gu;
  for (const [, reference] of html.matchAll(pattern)) {
    if (reference.startsWith('data:') || reference.startsWith('#')) continue;
    references.add(reference.replace(/^\.\//u, ''));
  }
  return [...references];
}

async function gzipBytes(file) {
  return gzipSync(await readFile(file), { level: 9 }).byteLength;
}

async function main() {
  const dist = process.argv[2] ?? 'apps/web/dist';
  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  const referenced = new Set(initialReferences(html));

  const files = (await readdir(path.join(dist, 'assets'))).map((name) =>
    path.posix.join('assets', name),
  );
  let initial = gzipSync(Buffer.from(html), { level: 9 }).byteLength;
  let total = initial;
  const deferred = [];
  for (const file of files) {
    const size = await gzipBytes(path.join(dist, file));
    total += size;
    if (referenced.has(file)) initial += size;
    else deferred.push({ file, size });
  }

  const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kio`;
  console.log(`Chargement initial : ${kb(initial)} compressé`);
  console.log(`Total produit      : ${kb(total)} compressé`);
  console.log(
    `À la demande       : ${deferred.length} fichier(s), ${kb(
      deferred.reduce((sum, entry) => sum + entry.size, 0),
    )}`,
  );

  const failures = [];
  if (initial > BUDGETS.initialGzipBytes)
    failures.push(
      `Le chargement initial fait ${kb(initial)} ; le budget est de ${kb(BUDGETS.initialGzipBytes)}.`,
    );
  if (total > BUDGETS.totalGzipBytes)
    failures.push(
      `Le total fait ${kb(total)} ; le budget est de ${kb(BUDGETS.totalGzipBytes)}.`,
    );
  if (failures.length > 0) {
    console.error('\nBudget dépassé :');
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error(
      '\nSoit une dépendance a grossi, soit du code chargé à la demande est',
    );
    console.error(
      'revenu dans le chargement initial. Décider, puis ajuster le budget.',
    );
    process.exit(1);
  }
  console.log('\nBudget tenu.');
}

if (process.argv[1]?.endsWith('check-bundle-budget.mjs')) await main();
