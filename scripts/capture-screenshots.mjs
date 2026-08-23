/**
 * Reprend les captures du README depuis l'application construite.
 *
 * Une capture d'écran est de la documentation, et une documentation qui montre
 * un dessin que le programme ne produit plus est pire qu'aucune : le lecteur
 * juge le projet sur une image périmée. Elle se reprend donc comme le reste se
 * régénère, par une commande, et non à la main un jour où quelqu'un y pense.
 *
 *   npm run build --workspace=@house-technical-designer/web
 *   npm run docs:screenshots
 *
 * Le navigateur est celui de Playwright. Sur une machine où
 * `npx playwright install chromium` n'a pas tourné mais où un Chromium existe
 * ailleurs, `CHROMIUM_PATH=/chemin/vers/chromium` le désigne.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '@playwright/test';

const DIST = 'apps/web/dist';
const OUT = 'docs/images/plan.png';
/** Assez large pour l'atelier entier, assez court pour n'en montrer que lui. */
const VIEWPORT = { width: 1440, height: 920 };

/**
 * Le calque que la capture éteint.
 *
 * Un plan de niveau montre le bâtiment ; la parcelle est le sujet d'un plan de
 * masse, et la garder dans le cadre réduit la maison au quart de l'image. C'est
 * un geste que l'application offre, fait ici comme un lecteur le ferait.
 */
const HIDDEN_LAYER = 'Terrain';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Sert le site construit, parce qu'un module ES ne se charge pas en file://. */
function serveDist() {
  const server = createServer((request, response) => {
    const asked = decodeURIComponent((request.url ?? '/').split('?')[0]);
    const file = path.join(DIST, asked === '/' ? 'index.html' : asked);
    readFile(file)
      .then((body) => {
        response.writeHead(200, {
          'content-type':
            TYPES[path.extname(file)] ?? 'application/octet-stream',
        });
        response.end(body);
      })
      .catch(() => {
        // Une application d'une seule page répond son index à tout le reste.
        readFile(path.join(DIST, 'index.html'))
          .then((body) => {
            response.writeHead(200, { 'content-type': TYPES['.html'] });
            response.end(body);
          })
          .catch(() => {
            response.writeHead(404);
            response.end();
          });
      });
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
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

const page = await browser.newPage({ viewport: VIEWPORT });
const failures = [];
page.on('pageerror', (error) => failures.push(error.message));
await page.goto(`http://127.0.0.1:${port}/`);
await page.getByRole('button', { name: 'Maison de démonstration' }).click();
await page.getByRole('status').filter({ hasText: 'démonstration' }).waitFor();
await page.locator('svg').first().waitFor();
await page.getByRole('button', { name: 'Visibilité' }).click();
const layers = page.getByRole('dialog', { name: 'Visibilité' });
await layers.getByText('Calque par calque').click();
await layers
  .locator('label', { hasText: HIDDEN_LAYER })
  .getByRole('checkbox')
  .uncheck();
await page.getByRole('button', { name: 'Visibilité' }).click();
// « Zoom étendu » : la capture montre la maison, pas le coin de la maison.
await page.keyboard.press('f');
// Le temps que la caméra soit appliquée au dessin.
await page.waitForTimeout(200);
// Sans l'anneau de focus du dernier bouton cliqué : la capture montre
// l'application au repos, pas la trace de la façon dont elle a été prise.
await page.getByRole('button', { name: 'Visibilité' }).blur();
await page.screenshot({ path: OUT });
await browser.close();
server.close();

if (failures.length > 0) {
  console.error(`Erreurs pendant la capture :\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `${OUT} repris depuis ${DIST} en ${VIEWPORT.width}×${VIEWPORT.height}.`,
);
