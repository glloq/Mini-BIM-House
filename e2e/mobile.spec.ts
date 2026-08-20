import { expect, test } from '@playwright/test';

/**
 * A phone loses the three-column layout, not the application: everything the
 * sidebar carries — the workspaces, the level, the layers, the discipline view
 * and the overlay — has to stay reachable.
 */
test('reaches every workspace through the drawer', async ({ page }) => {
  await page.goto('/');
  const sidebar = page.locator('#workspace-sidebar');
  const toggle = page.getByRole('button', { name: 'Espaces de travail' });

  await expect(toggle).toBeVisible();
  await expect(sidebar).not.toBeInViewport();

  await toggle.click();
  await expect(sidebar).toBeInViewport();
  await expect(
    page.getByRole('button', { name: 'Calculs', exact: true }),
  ).toBeVisible();
  await expect(page.locator('#workspace-sidebar select').first()).toBeVisible();

  // Choosing a workspace closes the drawer and shows that workspace.
  await page.getByRole('button', { name: 'Matériaux', exact: true }).click();
  await expect(sidebar).not.toBeInViewport();
  await expect(page.locator('.library-table tbody tr').first()).toBeVisible();
});

test('closes the drawer when the backdrop is tapped', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Espaces de travail' }).click();
  await expect(page.locator('#workspace-sidebar')).toBeInViewport();
  // The backdrop covers the screen, so the tap has to land beside the drawer.
  const backdrop = page.getByRole('button', {
    name: 'Fermer les espaces de travail',
  });
  const box = (await backdrop.boundingBox())!;
  await backdrop.click({ position: { x: box.width - 12, y: 12 } });
  await expect(page.locator('#workspace-sidebar')).not.toBeInViewport();

  // Escape closes it too, before it reaches the drawing tools.
  await page.getByRole('button', { name: 'Espaces de travail' }).click();
  await expect(page.locator('#workspace-sidebar')).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(page.locator('#workspace-sidebar')).not.toBeInViewport();
});

test('scrolls a wide table instead of overflowing the screen', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Maison de démonstration' }).click();
  await page.getByRole('button', { name: 'Espaces de travail' }).click();
  await page.getByRole('button', { name: 'Quantités', exact: true }).click();
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
