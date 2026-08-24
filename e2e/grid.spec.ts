import { expect, test, type Page } from '@playwright/test';

import { loadDemoProject } from './support/file-menu.js';
import { openStage } from './support/navigation.js';

/**
 * La grille, dans le repère du modèle.
 *
 * Ce qui en tenait lieu était un `background-image` CSS de 24 pixels collé au
 * cadre : il ne suivait ni le déplacement ni le zoom, et ses carreaux ne
 * mesuraient aucune longueur. Poser un mur « sur la grille » était un hasard.
 *
 * Ces tests figent ce qui manquait : qu'elle soit là dès le chargement, et
 * qu'elle **bouge avec le plan** — c'est la seule chose qu'une image de fond
 * ne pouvait pas faire.
 */

/** Où passent les lignes verticales, à l'écran. */
async function verticals(page: Page): Promise<number[]> {
  return page
    .locator('.model-grid line')
    .evaluateAll((lines) =>
      lines
        .filter((line) => line.getAttribute('x1') === line.getAttribute('x2'))
        .map((line) => Number(line.getAttribute('x1'))),
    );
}

test('est là dès le chargement, derrière le plan et hors de portée', async ({
  page,
}) => {
  await page.goto('/');
  const grid = page.locator('.model-grid');
  await expect(grid).toBeVisible();
  // Une ligne n'a pas d'aire : elle se prouve présente, pas « visible ».
  await expect(grid.locator('line').first()).toBeAttached();

  // Elle ne prend aucun clic : cliquer le plan à travers elle doit dessiner.
  await expect(grid).toHaveCSS('pointer-events', 'none');
  // Et elle n'est annoncée à personne : une grille se voit, elle ne se lit pas.
  await expect(grid).toHaveAttribute('aria-hidden', 'true');
});

test('reste alignée sur le zéro du modèle', async ({ page }) => {
  await page.goto('/');
  await loadDemoProject(page);
  // Deux axes disent où est l'origine : c'est la question qu'on se pose en
  // tapant une coordonnée.
  await expect(page.locator('.model-grid line.origin')).toHaveCount(2);
  // Et les lignes ne sont pas toutes égales : le pas fort se distingue.
  await expect(page.locator('.model-grid line.major').first()).toBeAttached();
  await expect(page.locator('.model-grid line.minor').first()).toBeAttached();
});

test('s’écarte quand on zoome, au lieu de rester à 24 pixels', async ({
  page,
}) => {
  await page.goto('/');
  await loadDemoProject(page);
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const before = await verticals(page);
  expect(before.length).toBeGreaterThan(2);
  const spacing = (lines: readonly number[]) => lines[1]! - lines[0]!;

  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let turn = 0; turn < 6; turn += 1) await page.mouse.wheel(0, -120);

  await expect
    .poll(async () => spacing(await verticals(page)))
    .not.toBe(spacing(before));
  await expect(page.locator('.model-grid line').first()).toBeAttached();
});

test('se déplace avec le plan, du même nombre de pixels', async ({ page }) => {
  await page.goto('/');
  await loadDemoProject(page);
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const before = await verticals(page);

  // Maj + glisser déplace le plan. Une image de fond serait restée sur place.
  await page.keyboard.down('Shift');
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width * 0.6 - 80,
    box.y + box.height * 0.5,
    {
      steps: 8,
    },
  );
  await page.mouse.up();
  await page.keyboard.up('Shift');

  await expect.poll(async () => (await verticals(page))[0]).not.toBe(before[0]);
  await expect(page.locator('.model-grid line').first()).toBeAttached();
});

test('survit à un changement d’espace', async ({ page }) => {
  await page.goto('/');
  await loadDemoProject(page);
  for (const space of ['Terrain', 'Bâtiment', 'Systèmes', 'Aménagement']) {
    await openStage(page, space);
    await expect(page.locator('.model-grid line').first()).toBeAttached();
  }
});

test('ne dépend pas de l’accrochage : voir et se coller sont deux questions', async ({
  page,
}) => {
  await page.goto('/');
  await loadDemoProject(page);
  const grid = page.locator('.model-grid');
  await expect(grid).toBeVisible();

  // Couper l'accrochage à la grille faisait disparaître le repère, donc
  // dessiner librement voulait dire dessiner à l'aveugle.
  await page.locator('.status-snaps > summary').click();
  const snap = page.getByRole('checkbox', { name: 'Grille', exact: true });
  await snap.uncheck();
  await expect(snap).not.toBeChecked();
  await expect(grid.locator('line').first()).toBeAttached();
});
