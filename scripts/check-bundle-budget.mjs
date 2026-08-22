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
   * Raised again from 248 kio for the interface of the twelfth audit: the five
   * spaces and the navigation that remembers what is open in each, the design
   * scope and what it sets aside, the tools moved into the context panel, the
   * contextual bar and the discipline picker. All of it is the shell — it is
   * on screen before anything is drawn, so it cannot be loaded later. What
   * could wait went the other way in the same pass: the creation page, the
   * visibility popover and everything they pull are now on demand.
   *
   * Raised once more, by two kio, for the resolved-number layer: what a total
   * says when one of its terms is unknown. It is a hundred lines and it is in
   * the initial chunk because the calculation adapters are.
   *
   * Raised by one more kio for the complete catalogue snapshot: the equipment
   * shape now describes the performance curves, the rendering and the source
   * of each figure, and that shape is compiled into the validator every import
   * runs. It is the price of a project that opens the same way with the
   * catalogue uninstalled.
   *
   * Raised by one more for the material and assembly catalogues: the sixteen
   * materials and the seven build-ups a new project starts with are data now
   * rather than two lists written out in the application, and a new project is
   * created before anything is drawn. The data is the same size as the code it
   * replaces; what grew is the loader and the gate around it.
   *
   * And one more for the opening catalogue: twelve models of window, door and
   * shutter, which a new project carries because `Opening.definitionId` named
   * an entry and nothing shipped one — so every window was drawn with a
   * transmittance nobody had stated.
   *
   * And a last kio for catalogue discovery: the six loaders find their files
   * instead of importing eight of them by name, which is what makes adding
   * fiches a `git add` rather than an edit to two TypeScript files.
   *
   * And six kio for the first two filling waves. Not the fiches — those are in
   * the catalogue browser, which is loaded on demand and stays there; this is
   * the nomenclature, which the editor holds because the inspector, the
   * workflows and the checks all ask it what a family is. It grew because
   * ninety-three families of water and drainage now state what they are
   * connected by rather than repeating one list per schema, because a hundred
   * and thirty families gained the coarse grouping the interface sorts on, and
   * because seven families of roof covering were declared. The nomenclature is
   * complete at five hundred and twenty-seven; the waves still to come add
   * fiches, and fiches are not loaded here.
   *
   * And back down to 260 once a new project stopped being handed the shelf.
   * The three catalogues were in this payload for one reason: creating a blank
   * project copied all of them into it, and creating a project is something
   * the application must be able to do before anything is loaded. A basket of
   * twenty-two entries replaced them, and taking the catalogue off the barrels
   * of `materials` and `assemblies` took the rest — importing a package for
   * `materialId` used to pull every fiche its tree holds, because the eager
   * glob runs on import and nothing tree-shakes a hundred JSON files away.
   *
   * What this number now protects is worth more than the kilobytes: six waves
   * of filling cost the first payload four hundred bytes, and the seventh will
   * cost none.
   *
   * A budget is a decision, not a measurement. This one was taken knowingly.
   */
  initialGzipBytes: 260 * 1024,
  /**
   * Everything the build produces, gzipped.
   *
   * Raised with the catalogues of the thirteenth audit: the materials, the
   * build-ups and the menuiseries are data now rather than three lists written
   * out in code, and data that a gate reads costs a little more than code
   * nobody checked.
   *
   * Raised again for the mass-fill gate: discovery in place of eight
   * hand-written imports, and every material and build-up carrying the
   * catalogue reference it came from.
   *
   * Raised by twelve kio for the first two filling waves: two hundred and
   * three new fiches — matériaux, compositions, menuiseries, mobilier, and the
   * ninety-three familles of water and drainage. Most of that weight is in the
   * catalogue browser's chunk, which is where it belongs; what it buys is that
   * a family offered to somebody has something behind it.
   *
   * Raised by twenty-four kio for waves three to six: two hundred and forty
   * fiches more — heating, ventilation, electricity, lighting, solar, storage,
   * flues, data, safety, the site — and seventeen network products. Every kio
   * of it landed on demand: the initial payload moved by less than one, which
   * is the whole point of the split and the reason this budget is counted in
   * two numbers rather than one.
   *
   * And two more when the catalogues left the first payload: what leaves it
   * has to land somewhere, and it landed on demand. That is the trade this
   * budget exists to make visible — the total went up by two kilobytes, the
   * download a first visit pays for went down by seven.
   */
  totalGzipBytes: 418 * 1024,
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
