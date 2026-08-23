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
   * Raised by ten kio for the graphic charter of the fourteenth audit. The
   * plan is no longer drawn from a table of thirty roles: a rule resolver
   * reads what the scene already said about each object, a second charter
   * states two palettes and the paper widths of a house rather than of a
   * schema, rooms carry a canonical use, openings carry the drawing their
   * family calls for, placed things carry the footprint their fiche declares,
   * and a label is placed where it fits rather than at the average of the
   * corners. All of it is the drawing, and the drawing is what the first visit
   * loads — a plan that appears after a second panel would not be a plan.
   *
   * Two kio of the ten are the eighteen emprises themselves. They are data in
   * `data/symbols`, found by the same discovery as every other catalogue, and
   * they travel with the editor because a bath has to be drawn as a bath
   * before anything else has been asked for.
   *
   * A budget is a decision, not a measurement. This one was taken knowingly.
   *
   * Un kio de plus pour les neuf étapes de création. Le registre remplace les
   * cinq espaces, qui pesaient déjà : ce que la refonte ajoute vraiment est le
   * compte de ce qu'il reste à faire par étape, dérivé du modèle et affiché en
   * permanence dans la barre. Un nombre qui dit « il reste trois choses dans
   * Systèmes » se paie dans le premier chargement, parce que la barre est là
   * dès le premier écran.
   *
   * Et cinq de plus pour la boîte à outils : cinquante-quatre dessins de vingt
   * pixels, plus les entrées qui disent ce qu'on pose. Une colonne de vingt-cinq
   * libellés se lit ligne à ligne ; une grille se balaie, et c'est l'icône qui
   * fait la grille. Aucun de ces octets ne peut attendre — la boîte est le
   * premier panneau du premier écran. Aucune bibliothèque d'icônes n'est
   * installée pour autant : ce sont des `<svg>` en ligne, en `currentColor`,
   * et la plus légère des bibliothèques aurait coûté davantage.
   *
   * Puis un de plus : la barre de vue, l'écran d'affichage unique et la phrase
   * qui dit ce que l'outil attend. Un demi-kio de moins serait revenu à
   * laisser quelqu'un découvrir en se trompant qu'un mur continu se termine
   * par Entrée.
   *
   * Puis deux avec les prédicats de disponibilité : ce que la maison est, lu
   * du modèle, et la raison écrite de chaque outil qui ne sert pas encore. Ces
   * phrases sont la fonction — les abréger reviendrait à griser des boutons en
   * silence, ce qui est précisément la panne qu'on répare.
   *
   * Et un avec le header du plan. Il rend bien plus qu'il ne prend : la coque
   * passe de 153 à 116 px au-dessus du dessin, et la colonne de gauche de
   * vingt-deux boutons à deux.
   *
   * Et deux avec le registre des headers : trente-sept sous-parties au lieu de
   * douze, et cent soixante entrées au lieu de quatre-vingts. Ce sont les
   * boutons eux-mêmes ; le catalogue qu'ils nomment, lui, reste à la demande —
   * un projet neuf l'installe depuis l'assistant de création, qui se charge
   * quand on le demande.
   *
   * Et un avec les étiquettes de surface : ce que les murs enferment, écrit
   * sur le plan. C'est le premier écran, et la question « est-ce que c'est
   * reconnu ? » se pose au premier contour fermé.
   */
  initialGzipBytes: 283 * 1024,
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
   *
   * And four more for the pickers: choosing a fiche instead of importing a
   * catalogue is a search box, a list of rows and a menuiseries panel that had
   * no home. All three land on demand, in the workspace that asks.
   *
   * And three more for the reference house, which is made of catalogue fiches
   * now: nineteen equipment fiches and three menuiseries with their ports,
   * their clearances, their sources and their performance curves, and thirty
   * and three objects standing somewhere in the building instead of nine, and
   * an envelope of five catalogue build-ups made of eleven catalogue materials
   * in place of three compositions written for that file alone. It is a
   * fixture, and it travels with the application because the demonstration
   * project is the application's front door. What it buys is that every module
   * is exercised by a house made of what a user can actually choose — the day
   * it was rebuilt from fiches, three modules stopped finding anything, and
   * the day its envelope was, the takeoff went looking for prices nobody had
   * declared. That is exactly the failure a demonstration project exists to
   * catch.
   *
   * And two more for the last of the contract gaps: twenty-one fiches for the
   * families the assembly registry could not describe — a column has a
   * section, a ridge has a length — twelve flue products so that a straight
   * section stops existing in two registries at once, and the retirement
   * reasons of the families that left service. A catalogue that only grows is
   * one nobody can correct; what a retirement costs is the sentence saying
   * where to go instead, and it is worth its bytes.
   *
   * And one more so the takeoff counts the floors and the roof. It read the
   * walls and nothing else: the ground slab, the intermediate floor and both
   * roof planes never reached the bill of materials, the cost total or the
   * carbon total, and the total did not say it was missing half the building —
   * it gave a figure.
   *
   * And ten more with the initial payload, for the same reason and by the same
   * amount: what the fourteenth audit added to the drawing is the drawing, so
   * none of it could be moved behind a lazy boundary.
   *
   * Et un de plus avec les neuf étapes : le registre des étapes et le compte
   * de ce qu'il reste, tous deux dans la coque.
   *
   * Et quatre avec la boîte à outils, pour la même raison et par le même
   * montant : les icônes sont le premier panneau du premier écran, donc rien
   * d'elles ne pouvait passer derrière une frontière paresseuse.
   *
   * Et un avec la barre de vue et l'instruction de l'outil. Le panneau
   * d'affichage, lui, se charge encore à la demande : on ne l'ouvre pas pour
   * dessiner un mur.
   *
   * Et un avec les prédicats de disponibilité : l'état dérivé et les raisons
   * partent dans le même chargement que la boîte à outils, faute de quoi la
   * première grille de l'écran serait grise sans un mot pendant qu'un morceau
   * arrive.
   *
   * Et un avec le header du plan : la rangée des sous-parties, la rangée
   * d'outils et le bandeau d'options sont le premier écran, et le premier
   * écran ne se charge pas en deux fois.
   *
   * Et dix avec le registre des headers et la maison de démonstration, qui
   * tient désormais les trente-quatre fiches supplémentaires que ses boutons
   * savent poser — un bouton qui ne peut rien poser est une promesse, et une
   * maison de démonstration qui n'en tient aucune est une démonstration de
   * boutons absents.
   *
   * Et un avec la barre d'état du §1 : le pas de grille en centimètres,
   * l'orthogonal sorti des réglages, le mode de cotation et l'échelle en
   * rapport. Sept cellules qu'on lit sans arrêt valent mieux que cinq qu'il
   * faut traduire.
   *
   * Et un avec les types de maison. Cinq listes de niveaux et deux fonctions
   * qui les lisent dans les deux sens : un kio pour ne plus commencer un
   * projet en empilant des étages à la main.
   *
   * Et un avec la vue d'ensemble des études, qui se charge avec l'écran
   * qu'elle ouvre — « où en est ma maison » est une autre question que
   * « qu'est-ce qui cloche », et elle méritait sa page.
   */
  totalGzipBytes: 463 * 1024,
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
