import { expect, test } from '@playwright/test';

import { fileAction } from './support/file-menu.js';

import { openDestination, openStage } from './support/navigation.js';

/**
 * A phone loses the three-column layout, not the application.
 *
 * L'étape en cours reste visible : c'est la seule chose que la coque ne cache
 * jamais, sur n'importe quel écran. Sur un téléphone elle le dit avec sa liste
 * déroulante. Ce qui devient un tiroir est le panneau de contexte, qui porte
 * le niveau, les calques, la vue disciplinaire et la superposition.
 */
test('keeps the stage visible and reaches every destination', async ({
  page,
}) => {
  await page.goto('/');
  const bar = page.getByRole('navigation', { name: 'Étapes de création' });
  await expect(bar).toBeInViewport();
  await expect(bar.getByLabel('Étape de création')).toBeVisible();

  // Un onglet s'ouvre sur ce à quoi il sert — pour Études, la vue d'ensemble
  // de ce que le bâtiment dessiné donne.
  await openStage(page, 'Études');
  await expect(page.getByText('Vérifications').first()).toBeVisible();

  // A destination inside a stage is the stage, then the drawer.
  await openDestination(page, 'Matériaux');
  await expect(page.locator('.library-table tbody tr').first()).toBeVisible();
  await expect(page.locator('#workspace-sidebar')).not.toBeInViewport();
});

test('keeps the plan and the commands on one row, and lifts the panel from the bottom', async ({
  page,
}) => {
  await page.goto('/');
  // « House Technical Designer » prenait la moitié d'un écran de 390 px et
  // poussait hors du bord les deux boutons qui ouvrent tout le reste.
  const header = page.locator('.app-header');
  await expect(header.locator('h1')).toBeHidden();
  await expect(
    header.getByRole('button', { name: 'Panneau', exact: true }),
  ).toBeInViewport();
  // Une seule rangée : ce qui ne tient pas défile, rien ne descend.
  expect((await header.boundingBox())!.height).toBeLessThan(56);

  // Le panneau monte du bas et laisse le plan au-dessus de lui : un tiroir
  // latéral de 20 rem recouvrirait les deux tiers du dessin.
  const sidebar = page.locator('#workspace-sidebar');
  await page.getByRole('button', { name: 'Panneau', exact: true }).click();
  await expect(sidebar).toBeInViewport();
  const sheet = (await sidebar.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(sheet.y).toBeGreaterThan(viewport.height * 0.3);
  expect(sheet.y + sheet.height).toBeGreaterThanOrEqual(viewport.height - 1);

  // Et « Affichage » reste au bord plutôt que d'être coupé en deux.
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: /^Affichage/u }),
  ).toBeInViewport();
});

test('opens the context panel as a drawer and closes it', async ({ page }) => {
  await page.goto('/');
  const sidebar = page.locator('#workspace-sidebar');
  const toggle = page.getByRole('button', { name: 'Panneau', exact: true });

  await expect(toggle).toBeVisible();
  await expect(sidebar).not.toBeInViewport();
  await toggle.click();
  await expect(sidebar).toBeInViewport();
  await expect(sidebar.locator('select').first()).toBeVisible();

  // The backdrop covers the screen, so the tap has to land beside the drawer.
  const backdrop = page.getByRole('button', { name: 'Fermer le panneau' });
  const box = (await backdrop.boundingBox())!;
  await backdrop.click({ position: { x: box.width - 12, y: 12 } });
  await expect(sidebar).not.toBeInViewport();

  // Escape closes it too, before it reaches the drawing tools.
  await toggle.click();
  await expect(sidebar).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(sidebar).not.toBeInViewport();
});

test('scrolls a wide table instead of overflowing the screen', async ({
  page,
}) => {
  await page.goto('/');
  await fileAction(page, 'Maison de démonstration');
  await openDestination(page, 'Quantités');
  const scroller = page.locator('.table-scroll').first();
  await expect(scroller).toBeVisible();
  const overflows = await scroller.evaluate(
    (element) => element.scrollWidth > element.clientWidth,
  );
  expect(overflows).toBe(true);
  // The page itself never scrolls sideways.
  const body = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth + 1);
});
