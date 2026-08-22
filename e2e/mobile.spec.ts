import { expect, test } from '@playwright/test';

import { openDestination } from './support/navigation.js';

/**
 * A phone loses the three-column layout, not the application.
 *
 * The five spaces stay visible as a row — they are the one thing that never
 * hides, on any screen. What becomes a drawer is the context panel, which
 * carries the level, the layers, the discipline view and the overlay.
 */
test('keeps the five spaces visible and reaches every destination', async ({
  page,
}) => {
  await page.goto('/');
  const rail = page.getByRole('navigation', { name: 'Espaces de travail' });
  await expect(rail).toBeInViewport();
  await expect(rail.getByRole('button')).toHaveCount(5);

  // A space is one tap, and it opens on what that space is for — for
  // Analyser, the plan the results are about.
  await rail.getByRole('button', { name: 'Analyser', exact: true }).click();
  await expect(page.locator('.plan-canvas')).toBeVisible();

  // A destination inside a space is the space, then the drawer.
  await openDestination(page, 'Matériaux');
  await expect(page.locator('.library-table tbody tr').first()).toBeVisible();
  await expect(page.locator('#workspace-sidebar')).not.toBeInViewport();
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
  await page.getByRole('button', { name: 'Maison de démonstration' }).click();
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
