/**
 * Ce que la coque coûte à l'écran, mesuré plutôt qu'estimé.
 *
 * Une interface se juge sur des nombres avant de se juger sur un goût. Ceux-ci
 * disaient, avant la refonte : une page de 2 101 px pour une fenêtre de 900,
 * 306 px de chrome avant le premier pixel de plan, 143 boutons dans le panneau
 * gauche quelle que soit l'activité. Aucun de ces trois défauts n'était visible
 * dans une revue de code, et tous les trois étaient visibles à l'œil nu.
 *
 *   npm run build --workspace=@house-technical-designer/web
 *   npm run measure:shell            affiche le tableau
 *   npm run measure:shell -- --check  échoue si un budget est dépassé
 *
 * Un budget est une décision, pas une mesure : il se resserre PR après PR, et
 * chaque resserrement dit pourquoi. Le navigateur est celui de Playwright ;
 * CHROMIUM_PATH désigne un Chromium installé ailleurs.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '@playwright/test';

const DIST = 'apps/web/dist';

/**
 * Les cinq formats du §10, plus le portable ordinaire.
 *
 * Le mobile n'est pas le bureau rétréci : ce qui compte à 390 px n'est pas ce
 * qui compte à 1 600, et une mesure qui ne regarde que le large ne voit pas la
 * coque s'empiler.
 */
const FORMATS = [
  { id: 'wide', label: '1600 × 900', width: 1600, height: 900 },
  { id: 'laptop', label: '1280 × 800', width: 1280, height: 800 },
  { id: 'small-laptop', label: '1024 × 768', width: 1024, height: 768 },
  { id: 'tablet', label: '820 × 1180', width: 820, height: 1180 },
  /*
   * Un doigt n'est pas un pointeur.
   *
   * Sur un écran tactile les contrôles sont plus hauts, exprès : la barre de
   * vue y fait 48 px et non 34. Ce n'est pas un défaut à corriger, c'est une
   * décision prise ailleurs dans la feuille de style, et le budget la reprend
   * plutôt que de la contredire.
   */
  { id: 'phone', label: '390 × 844', width: 390, height: 844, chromePx: 175 },
];

/**
 * Ce que la coque a le droit de prendre.
 *
 * Valeurs de départ : celles que UX-1 atteint. La cible finale de
 * `docs/UX_REDESIGN_V2.md` §13.1 est plus stricte sur deux points — vingt
 * boutons dans le panneau gauche et 120 px de chrome — et demande la boîte à
 * outils contextuelle (UX-3) pour être tenue. Resserrer ici est le geste qui
 * clôt chaque PR de la refonte.
 */
export const SHELL_BUDGETS = {
  /** La page ne déborde pas de la fenêtre : une coque n'est pas un document. */
  overflowPx: 0,
  /**
   * Pixels pris au-dessus du plan par les barres.
   *
   * Trois cent six au départ. UX-1 en a fait 131 ; UX-2 en a ajouté 34, la
   * barre d'étapes étant une rangée là où le rail était une colonne de 56 px —
   * de la hauteur payée pour de la largeur rendue. UX-5 fond l'en-tête du
   * canvas dans la barre de vue et colle la barre d'outil au dessin : 153.
   *
   * C'est le compte du §9 de la spécification : 44 (titre) + 34 (étapes) +
   * 34 (vue) + 40 (outil), plus un pixel de bordure. Le seuil de « ≤ 120 px »
   * du §13.1 a été écrit avant que ces quatre barres ne soient posées, et son
   * arithmétique le contredit : quatre rangées ne tiennent pas dans 120 px.
   * Descendre plus bas demanderait d'en retirer une, ce que la spécification
   * ne demande pas.
   */
  chromeAboveCanvasPx: 155,
  topBarPx: 48,
  /**
   * Part de la fenêtre occupée par le plan.
   *
   * Mesurée au repos — la maison chargée, rien de sélectionné, donc
   * l'inspecteur replié. UX-1 en mesure 54 % sur un portable ; la cible de
   * §13.1 est 70 %, et il y faut le panneau gauche contextuel (UX-3).
   */
  minimumCanvasShare: 0.5,
  /**
   * Boutons offerts d'un coup dans la colonne de gauche.
   *
   * Cette mesure comptait le DOM et annonçait 143 : elle additionnait tout ce
   * qui dormait dans un dépliage fermé — les cent onze entrées de
   * l'arborescence, les « Plus d'outils » de chaque groupe. Un bouton replié
   * est atteignable, il n'est pas offert, et c'est la seconde chose qu'il
   * fallait compter. Offerts d'un coup, ils étaient vingt-cinq avant UX-3 et
   * sont vingt-quatre après.
   *
   * Ce que UX-3 change n'est donc pas le nombre : c'est ce que ces boutons
   * sont. Vingt-cinq outils génériques qui ne bougeaient jamais, contre une
   * dizaine d'entrées qui nomment ce qu'on pose — Porte, Fenêtre, WC, Prise —
   * et qui suivent l'étape, plus neuf communs. Le budget est ici pour
   * empêcher la colonne de regrossir.
   *
   * UX-4 en ajoute deux — les niveaux, pour une question qu'on se posait en
   * permanence — et UX-8 en retire quatre : les bibliothèques ne sont plus des
   * destinations en tête du panneau, elles se rangent avec ce qu'on cherche.
   * Vingt-deux.
   */
  leftColumnButtons: 26,
  /** Zones qui réservent de la place sans rien montrer. */
  emptyReservedZones: 0,
};

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
 * Ce que le navigateur mesure, une fois la maison de démonstration chargée.
 *
 * Cette fonction est sérialisée et exécutée dans la page : `document` et
 * `window` y sont ceux du navigateur, pas ceux de Node.
 */
/* global document, window */
function readShell() {
  const height = (selector) =>
    Math.round(
      document.querySelector(selector)?.getBoundingClientRect().height ?? 0,
    );
  const view = { width: window.innerWidth, height: window.innerHeight };
  const canvas = document
    .querySelector('.plan-canvas')
    ?.getBoundingClientRect();
  const visible = (rect) =>
    rect === undefined
      ? 0
      : Math.max(0, Math.min(rect.right, view.width) - Math.max(rect.left, 0)) *
        Math.max(0, Math.min(rect.bottom, view.height) - Math.max(rect.top, 0));
  // Une zone qui réserve de la place sans rien montrer : le défaut que la
  // refonte poursuit, et qu'un œil pardonne parce qu'il ne la voit pas.
  const reserved = [
    ...document.querySelectorAll('.sidebar, .inspector, .panel'),
  ].filter((element) => {
    const box = element.getBoundingClientRect();
    if (box.width < 24 || box.height < 24) return false;
    return (element.textContent ?? '').trim() === '';
  }).length;
  return {
    viewportPx: view.width * view.height,
    scrollHeight: document.documentElement.scrollHeight,
    overflowPx: Math.max(
      0,
      document.documentElement.scrollHeight - view.height,
    ),
    topBarPx: height('.app-header'),
    chromeAboveCanvasPx: canvas === undefined ? 0 : Math.round(canvas.top),
    canvasVisiblePx: visible(canvas),
    // Ce qui est offert d'un coup, et non ce que le DOM contient.
    //
    // Un bouton dans un dépliage fermé est atteignable ; il n'est pas offert,
    // et c'est exactement la différence que la refonte poursuit. Le navigateur
    // garde ces boutons dans le document et leur laisse même une boîte, donc
    // la question se pose au `details` : est-il ouvert ?
    leftColumnButtons: [...document.querySelectorAll('.sidebar button')].filter(
      (element) => {
        if (element.getClientRects().length === 0) return false;
        for (
          let holder = element.parentElement;
          holder !== null;
          holder = holder.parentElement
        ) {
          if (holder.tagName === 'DETAILS' && !holder.open) return false;
          if (holder.classList.contains('sidebar')) break;
        }
        return true;
      },
    ).length,
    emptyReservedZones: reserved,
  };
}

async function measure(page, format, port) {
  await page.setViewportSize({ width: format.width, height: format.height });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.getByRole('button', { name: 'Fichier' }).click();
  await page.getByRole('menuitem', { name: 'Maison de démonstration' }).click();
  await page.getByRole('status').filter({ hasText: 'démonstration' }).waitFor();
  await page.locator('.plan-canvas').first().waitFor();
  await page.waitForTimeout(250);
  const raw = await page.evaluate(readShell);
  return {
    ...format,
    ...raw,
    canvasShare: raw.canvasVisiblePx / raw.viewportPx,
  };
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
const measured = [];
for (const format of FORMATS) measured.push(await measure(page, format, port));
await browser.close();
server.close();

const pct = (value) => `${Math.round(value * 100)} %`;
console.log('');
for (const shell of measured) {
  console.log(`${shell.label}`);
  console.log(
    `  page                ${shell.scrollHeight} px (débordement ${shell.overflowPx})`,
  );
  console.log(`  barre supérieure    ${shell.topBarPx} px`);
  console.log(`  chrome avant plan   ${shell.chromeAboveCanvasPx} px`);
  console.log(`  plan visible        ${pct(shell.canvasShare)}`);
  console.log(`  boutons à gauche    ${shell.leftColumnButtons}`);
  console.log(`  zones vides         ${shell.emptyReservedZones}`);
  console.log('');
}

if (!process.argv.includes('--check')) process.exit(0);

const failures = [];
for (const shell of measured) {
  const at = (message) => failures.push(`${shell.label} — ${message}`);
  if (shell.overflowPx > SHELL_BUDGETS.overflowPx)
    at(`la page déborde de ${shell.overflowPx} px sous la fenêtre.`);
  if (shell.topBarPx > SHELL_BUDGETS.topBarPx)
    at(
      `la barre supérieure fait ${shell.topBarPx} px ; le budget est de ${SHELL_BUDGETS.topBarPx}.`,
    );
  const chromeBudget = shell.chromePx ?? SHELL_BUDGETS.chromeAboveCanvasPx;
  if (shell.chromeAboveCanvasPx > chromeBudget)
    at(
      `${shell.chromeAboveCanvasPx} px de chrome avant le plan ; le budget est de ${chromeBudget}.`,
    );
  if (shell.canvasShare < SHELL_BUDGETS.minimumCanvasShare)
    at(
      `le plan n'occupe que ${pct(shell.canvasShare)} de la fenêtre ; le budget est de ${pct(SHELL_BUDGETS.minimumCanvasShare)}.`,
    );
  if (shell.leftColumnButtons > SHELL_BUDGETS.leftColumnButtons)
    at(
      `${shell.leftColumnButtons} boutons dans la colonne de gauche ; le budget est de ${SHELL_BUDGETS.leftColumnButtons}.`,
    );
  if (shell.emptyReservedZones > SHELL_BUDGETS.emptyReservedZones)
    at(`${shell.emptyReservedZones} zone(s) réservée(s) sans rien montrer.`);
}

if (failures.length === 0) {
  console.log('Budgets tenus.');
  process.exit(0);
}
console.error('Budget de coque dépassé :');
for (const failure of failures) console.error(`  - ${failure}`);
console.error('');
console.error(
  'Soit la coque a grossi, soit le budget doit être décidé à nouveau.',
);
process.exit(1);
