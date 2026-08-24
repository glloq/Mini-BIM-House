/**
 * Ce que l'écran cache sans le dire.
 *
 * Une mise en page se juge sur ce qu'on peut atteindre, et « je ne le vois
 * pas » n'est pas la même panne que « il n'y est pas ». `measure-shell.mjs`
 * répond de la coque au repos : sa hauteur, sa part de plan, son débordement.
 * Il ne visite qu'un écran — la maison chargée, l'onglet Bâtiment — et sept
 * espaces, treize destinations et une trentaine de sous-parties font bien plus
 * d'un écran.
 *
 * Celui-ci les visite tous, à quatre tailles de fenêtre, et cherche deux
 * défauts qu'un œil pardonne parce qu'il ne les voit pas :
 *
 * - **coupé** — l'élément sort d'un cadre qui le rogne (`overflow: hidden`) et
 *   aucun cadre intérieur ne défile pour le rattraper. Il est dans le
 *   document, il n'est nulle part sur l'écran.
 * - **hors écran** — l'élément est entièrement en dehors de la fenêtre et rien
 *   ne défile pour l'y ramener.
 *
 *   npm run build --workspace=@house-technical-designer/web
 *   npm run audit:layout             affiche le rapport
 *   npm run audit:layout -- --check  échoue s'il reste un défaut
 *
 * Le navigateur est celui de Playwright ; `CHROMIUM_PATH` en désigne un autre.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '@playwright/test';

const DIST = 'apps/web/dist';

/**
 * Quatre fenêtres, et non une.
 *
 * Un défaut de mise en page est presque toujours un défaut de largeur : ce qui
 * tient à 1 600 px déborde à 1 024, et ce qui tient à 1 024 s'empile à 390. La
 * tablette est là parce qu'elle est haute et étroite à la fois, ce qu'aucune
 * des trois autres n'est.
 */
const FORMATS = [
  { label: '1600 × 900', width: 1600, height: 900 },
  { label: '1280 × 800', width: 1280, height: 800 },
  { label: '1024 × 768', width: 1024, height: 768 },
  { label: '820 × 1180', width: 820, height: 1180 },
  { label: '390 × 844', width: 390, height: 844 },
];

const STAGES = [
  'Projet',
  'Terrain',
  'Bâtiment',
  'Aménagement',
  'Systèmes',
  'Études',
  'Documents',
];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

function serveDist() {
  const server = createServer((request, response) => {
    const asked = decodeURIComponent((request.url ?? '/').split('?')[0]);
    const file = path.join(DIST, asked === '/' ? 'index.html' : asked);
    const send = (body, type) => {
      response.writeHead(200, { 'content-type': type });
      response.end(body);
    };
    readFile(file)
      .then((body) =>
        send(body, TYPES[path.extname(file)] ?? 'application/octet-stream'),
      )
      .catch(() =>
        readFile(path.join(DIST, 'index.html'))
          .then((body) => send(body, TYPES['.html']))
          .catch(() => {
            response.writeHead(404);
            response.end();
          }),
      );
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/**
 * Ce que le navigateur trouve d'inatteignable sur l'écran ouvert.
 *
 * Sérialisée et exécutée dans la page : `document` et `window` y sont ceux du
 * navigateur.
 */
/* global document, window, getComputedStyle */
function findUnreachable() {
  const view = { width: window.innerWidth, height: window.innerHeight };
  const problems = [];
  /*
   * Ce qui porte du sens, et non tout le document.
   *
   * Un `<div>` de mise en page qui dépasse de deux pixels n'intéresse
   * personne ; un bouton, un champ, un titre ou une cellule qu'on ne peut pas
   * atteindre est une fonction perdue.
   */
  const CANDIDATES = [
    'button',
    'a[href]',
    'input',
    'select',
    'textarea',
    'summary',
    '[role="button"]',
    '[role="tab"]',
    '[role="option"]',
    'h1',
    'h2',
    'h3',
    'h4',
    'th',
    'td',
    'dt',
    'dd',
  ].join(', ');

  const name = (element) => {
    const own = (
      element.getAttribute('aria-label') ??
      element.textContent ??
      ''
    )
      .trim()
      .replace(/\s+/gu, ' ');
    if (own.length === 0) return `<${element.tagName.toLowerCase()}>`;
    return own.length > 48 ? `${own.slice(0, 45)}…` : own;
  };
  const where = (element) => {
    const parts = [];
    for (
      let node = element;
      node !== null && node !== document.body && parts.length < 3;
      node = node.parentElement
    ) {
      const first =
        typeof node.className === 'string'
          ? node.className.trim().split(/\s+/u)[0]
          : '';
      parts.unshift(
        first.length > 0 ? `.${first}` : node.tagName.toLowerCase(),
      );
    }
    return parts.join(' ');
  };

  const scrolls = (overflow) => overflow === 'auto' || overflow === 'scroll';
  const clips = (overflow) => overflow === 'hidden' || overflow === 'clip';

  for (const element of document.querySelectorAll(CANDIDATES)) {
    if (element.getClientRects().length === 0) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;

    /*
     * Un dépliage fermé n'est pas un défaut.
     *
     * Le navigateur garde son contenu dans le document et lui laisse même une
     * boîte. Il est rangé, pas perdu — c'est même toute l'idée du sommaire.
     */
    let folded = false;
    for (let holder = element.parentElement; holder !== null;)
      if (holder.tagName === 'DETAILS' && !holder.open) {
        folded = element.tagName !== 'SUMMARY';
        break;
      } else holder = holder.parentElement;
    if (folded) continue;

    let reachX = false;
    let reachY = false;
    let cutBy = null;
    let axis = '';
    let over = '';
    for (
      let holder = element.parentElement;
      holder !== null && holder !== document.body;
      holder = holder.parentElement
    ) {
      const style = getComputedStyle(holder);
      const box = holder.getBoundingClientRect();
      // Un cadre qui défile rattrape ce qui en sort — mais seulement ce qui
      // est **dedans** : un cadre extérieur ne rattrape pas ce qu'un cadre
      // intérieur a déjà rogné, et c'est pourquoi l'ordre compte.
      if (scrolls(style.overflowX)) reachX = true;
      if (scrolls(style.overflowY)) reachY = true;
      if (
        !reachX &&
        clips(style.overflowX) &&
        (rect.right > box.right + 2 || rect.left < box.left - 2)
      ) {
        cutBy = holder;
        axis = 'largeur';
        over =
          rect.left < box.left - 2
            ? `${Math.round(box.left - rect.left)} px à gauche`
            : `${Math.round(rect.right - box.right)} px à droite`;
        break;
      }
      if (
        !reachY &&
        clips(style.overflowY) &&
        (rect.bottom > box.bottom + 2 || rect.top < box.top - 2)
      ) {
        cutBy = holder;
        axis = 'hauteur';
        over =
          rect.top < box.top - 2
            ? `${Math.round(box.top - rect.top)} px au-dessus`
            : `${Math.round(rect.bottom - box.bottom)} px au-dessous`;
        break;
      }
    }
    if (cutBy !== null) {
      problems.push({
        kind: 'coupé',
        label: name(element),
        where: where(element),
        by: where(cutBy),
        axis,
        over,
      });
      continue;
    }

    const root = document.documentElement;
    const pageScrollsX = root.scrollWidth > root.clientWidth + 1;
    const pageScrollsY = root.scrollHeight > root.clientHeight + 1;
    const offX = rect.right <= 0 || rect.left >= view.width;
    const offY = rect.bottom <= 0 || rect.top >= view.height;
    if (
      (offX && !reachX && !pageScrollsX) ||
      (offY && !reachY && !pageScrollsY)
    )
      problems.push({
        kind: 'hors écran',
        label: name(element),
        where: where(element),
        by: '',
        axis: offX ? 'largeur' : 'hauteur',
        over: '',
      });
  }
  return problems;
}

async function loadDemo(page, port) {
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.getByRole('button', { name: 'Fichier' }).click();
  await page.getByRole('menuitem', { name: 'Maison de démonstration' }).click();
  await page.getByRole('status').filter({ hasText: 'démonstration' }).waitFor();
}

async function openStage(page, stage) {
  const bar = page.getByRole('navigation', { name: 'Étapes de création' });
  const entry = bar.getByRole('button', { name: stage, exact: true });
  if (await entry.isVisible()) await entry.click();
  else await bar.getByLabel('Étape de création').selectOption({ label: stage });
}

/**
 * Sur un écran étroit le panneau est un tiroir : on l'ouvre pour le lire.
 *
 * Le bouton bascule : le cliquer sans regarder refermait ce qu'on venait
 * d'ouvrir un écran sur deux.
 */
async function openPanel(page) {
  const sidebar = page.locator('#workspace-sidebar');
  if ((await sidebar.count()) === 0) return;
  /*
   * « Visible » ne veut pas dire « sur l'écran ».
   *
   * Le tiroir fermé est posé en `fixed` et poussé de −102 % : le navigateur le
   * dit visible — il a une boîte, il n'est pas `hidden` — et il est pourtant
   * entièrement hors du bord. Se fier à `isVisible()` faisait croire l'audit
   * dans un panneau ouvert alors qu'il auditait un tiroir clos, et déclarait
   * inatteignable chacun de ses boutons.
   */
  const shown = await sidebar.evaluate(
    (element) =>
      getComputedStyle(element).position !== 'fixed' ||
      element.classList.contains('open'),
  );
  if (shown) return;
  const toggle = page.getByRole('button', { name: 'Panneau', exact: true });
  if (await toggle.isVisible()) await toggle.click();
}

/** Et refermé : son voile prend les clics destinés au dessin. */
async function closePanel(page) {
  const backdrop = page.locator('.drawer-backdrop');
  if ((await backdrop.count()) > 0 && (await backdrop.isVisible()))
    await backdrop.click();
}

/**
 * Cliquer, et compter l'échec plutôt que de s'arrêter dessus.
 *
 * Un bouton que le navigateur voit mais ne peut pas amener sous le pointeur —
 * « element is outside of the viewport », après avoir fait défiler tout ce
 * qu'il pouvait — est exactement le défaut qu'on cherche. L'audit le note et
 * continue : s'arrêter au premier ferait manquer les suivants.
 */
async function tryClick(locator, found, format, screen, label) {
  const done = await locator
    .click({ timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  if (!done)
    found.push({
      kind: 'inatteignable',
      label,
      where: '',
      by: '',
      axis: '',
      over: '',
      format: format.label,
      screen,
    });
  return done;
}

async function auditScreen(page, found, format, screen) {
  await page.waitForTimeout(120);
  for (const problem of await page.evaluate(findUnreachable))
    found.push({ ...problem, format: format.label, screen });
}

async function auditFormat(page, port, format) {
  const found = [];
  process.stderr.write(`  ${format.label} : les écrans\n`);
  await page.setViewportSize({ width: format.width, height: format.height });
  await loadDemo(page, port);
  for (const stage of STAGES) {
    await openStage(page, stage);
    await openPanel(page);
    await auditScreen(page, found, format, stage);

    // Les destinations de l'espace : chacune est un écran entier.
    const destinations = page
      .locator('#workspace-sidebar')
      .getByRole('group', { name: /^Ouvrir dans / })
      .getByRole('button');
    const labels = await destinations.allInnerTexts();
    for (const label of labels) {
      await openStage(page, stage);
      await openPanel(page);
      const entry = page
        .locator('#workspace-sidebar')
        .getByRole('button', { name: label, exact: true });
      if ((await entry.count()) === 0) continue;
      await openPanel(page);
      const reached = await tryClick(
        entry.first(),
        found,
        format,
        `${stage} › ${label}`,
        label,
      );
      if (!reached) continue;
      await auditScreen(page, found, format, `${stage} › ${label}`);
    }

    // Puis les sous-parties, une par une : chacune ouvre sa propre liste.
    await openStage(page, stage);
    await openPanel(page);
    const folds = page
      .getByRole('navigation', { name: 'Sous-parties' })
      .locator('details.section-fold > summary');
    const count = await folds.count();
    for (let index = 0; index < count; index += 1) {
      const summary = folds.nth(index);
      const part = (await summary.getAttribute('aria-label')) ?? `#${index}`;
      // Prendre un outil referme le tiroir, sur un téléphone : c'est ce qu'il
      // faut pour dessiner. Le parcours le rouvre, comme une personne le fait.
      await openPanel(page);
      if (!(await tryClick(summary, found, format, stage, part))) continue;
      await auditScreen(page, found, format, `${stage} › ${part}`);
      /*
       * Et chaque entrée prise, une par une.
       *
       * Prendre un outil ouvre la seconde ligne — ses options — et c'est un
       * écran de plus, différent pour chaque entrée puisque chacune pré-remplit
       * ce qu'elle pose. Deux cent quarante boutons font deux cent quarante
       * écrans que personne n'avait regardés.
       */
      const entries = page
        .getByRole('navigation', { name: 'Sous-parties' })
        .locator('details.section-fold[open] .add-grid > button');
      const offered = await entries.count();
      for (let seat = 0; seat < offered; seat += 1) {
        const button = entries.nth(seat);
        const label = (await button.textContent())?.trim() ?? `#${seat}`;
        if (await button.isDisabled()) continue;
        const seen = `${stage} › ${part}`;
        await openPanel(page);
        if (!(await tryClick(button, found, format, seen, label))) continue;
        await auditScreen(page, found, format, `${seen} › ${label}`);
        await page.keyboard.press('Escape');
      }
    }
  }
  return found;
}

/**
 * Ce qui s'ouvre par-dessus, et qu'aucun parcours d'écran ne visite.
 *
 * Un menu, une palette, un panneau d'affichage, l'inspecteur d'un objet
 * désigné : ce sont des écrans à part entière, et ils sont posés en `fixed` ou
 * en `absolute` — c'est-à-dire là où une mise en page se casse le plus
 * facilement.
 */
async function auditOverlays(page, port, format) {
  const found = [];
  process.stderr.write(`  ${format.label} : ce qui s’ouvre par-dessus\n`);
  await page.setViewportSize({ width: format.width, height: format.height });
  await loadDemo(page, port);

  const at = (screen, locator, label) =>
    tryClick(locator, found, format, screen, label);

  if (
    await at(
      'menu Fichier',
      page.getByRole('button', { name: 'Fichier' }),
      'Fichier',
    )
  ) {
    await auditScreen(page, found, format, 'menu Fichier');
    await page.keyboard.press('Escape');
  }

  if (
    await at(
      'palette de commandes',
      page.getByRole('button', { name: 'Rechercher' }),
      'Rechercher',
    )
  ) {
    await auditScreen(page, found, format, 'palette de commandes');
    await page.getByLabel('Chercher une commande').fill('mur');
    await auditScreen(page, found, format, 'palette de commandes · « mur »');
    await page.keyboard.press('Escape');
  }

  await openStage(page, 'Bâtiment');
  // Le tiroir couvre le plan et son voile prend les clics : ce qui se trouve
  // sur le dessin se regarde tiroir fermé.
  await closePanel(page);
  if (
    await at(
      'panneau Affichage',
      page.getByRole('button', { name: /^Affichage/u }),
      'Affichage',
    )
  ) {
    await auditScreen(page, found, format, 'panneau Affichage');
    await page.keyboard.press('Escape');
  }

  // Un objet désigné : l'inspecteur, ses champs et ses dépliages.
  const wall = page.locator('[id="wall:wall-south"]');
  if ((await wall.count()) > 0) {
    const canvas = page.locator('.plan-canvas');
    const box = await canvas.boundingBox();
    const on = await wall.boundingBox();
    if (box !== null && on !== null) {
      // Viser un mur sur un écran de téléphone n'est pas toujours possible :
      // c'est l'adresse du parcours qui manque, pas une mise en page cassée.
      const aimed = await canvas
        .click({
          timeout: 4000,
          position: {
            x: on.x - box.x + on.width * 0.25,
            y: on.y - box.y + on.height / 2,
          },
        })
        .then(() => true)
        .catch(() => false);
      if (aimed) await auditScreen(page, found, format, 'inspecteur · un mur');
      const folds = page.locator('.inspector details:not([open]) > summary');
      const count = await folds.count();
      for (let index = 0; index < count; index += 1) {
        const fold = folds.nth(index);
        const name = (await fold.textContent())?.trim() ?? `#${index}`;
        if (!(await at('inspecteur · un mur', fold, name))) continue;
        await auditScreen(page, found, format, 'inspecteur · un mur, déplié');
      }
    }
  }

  // Et l'arborescence du projet, dépliée comme on la déplie.
  await page.keyboard.press('Escape');
  await openPanel(page);
  const tree = page.locator('details.project-tree-fold > summary');
  if (
    (await tree.count()) > 0 &&
    (await at('arborescence du projet', tree.first(), 'Éléments du projet'))
  )
    await auditScreen(page, found, format, 'arborescence du projet');
  return found;
}

const server = await serveDist().catch((error) => {
  console.error(
    `Le site construit est introuvable sous ${DIST} : ${error.message}`,
  );
  console.error(
    'Lancer d’abord npm run build --workspace=@house-technical-designer/web',
  );
  process.exit(1);
});
const { port } = server.address();

const executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium
  .launch(executablePath === undefined ? {} : { executablePath })
  .catch((error) => {
    console.error(error.message);
    console.error(
      'Installer le navigateur (npx playwright install chromium) ou désigner un Chromium par CHROMIUM_PATH.',
    );
    process.exit(1);
  });

const page = await browser.newPage();
const problems = [];
for (const format of FORMATS) {
  problems.push(...(await auditFormat(page, port, format)));
  problems.push(...(await auditOverlays(page, port, format)));
}
await browser.close();
server.close();

/*
 * Le même défaut vu sur douze écrans est un défaut, pas douze.
 *
 * Un bouton rogné par le même cadre à la même taille de fenêtre se retrouve
 * dans chaque sous-partie qu'on ouvre : les compter tous noierait ce qui est
 * unique dans ce qui est répété.
 */
const grouped = new Map();
for (const problem of problems) {
  const key = `${problem.format}|${problem.kind}|${problem.axis}|${problem.where}|${problem.by}|${problem.label}|${problem.over}`;
  const held = grouped.get(key);
  if (held === undefined)
    grouped.set(key, { ...problem, screens: [problem.screen] });
  else if (!held.screens.includes(problem.screen))
    held.screens.push(problem.screen);
}

console.log('');
if (grouped.size === 0) console.log('Rien d’inatteignable.');
for (const problem of grouped.values()) {
  console.log(
    `${problem.format} — ${problem.kind} (${problem.axis}) : ${problem.label}`,
  );
  console.log(`  ${problem.where}`);
  if (problem.by.length > 0)
    console.log(`  rogné par ${problem.by} — ${problem.over}`);
  const shown = problem.screens.slice(0, 4).join(', ');
  console.log(
    `  ${problem.screens.length} écran(s) : ${shown}${problem.screens.length > 4 ? '…' : ''}`,
  );
  console.log('');
}
console.log(
  `${grouped.size} défaut(s) distinct(s), ${problems.length} occurrence(s).`,
);

if (!process.argv.includes('--check')) process.exit(0);
process.exit(grouped.size === 0 ? 0 : 1);
