import { expect, test, type Page } from '@playwright/test';

/**
 * The journey every supported engine must complete.
 *
 * The full suite runs on Chromium; Firefox and WebKit run this file. What it
 * covers is what actually differs between engines — canvas pointer geometry,
 * IndexedDB, downloads, file input, and the compression the container format
 * relies on — rather than the application logic, which is the same code
 * everywhere and is already covered by the unit tests.
 */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (message.text().includes('favicon')) return;
    errors.push(`console: ${message.text()}`);
  });
  return errors;
}

test('draws, calculates, saves and reopens on this engine', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'House Technical Designer',
  );

  await page.getByRole('button', { name: 'Maison de démonstration' }).click();
  await expect(page.getByRole('status')).toContainText('démonstration');
  const walls = page.locator('[data-role="WALL_CUT"][id^="wall:"]');
  await expect(walls).toHaveCount(6);

  // Pointer coordinates on a canvas are where engines disagree most.
  await page.getByRole('button', { name: 'Mur', exact: true }).click();
  const canvas = page.locator('.plan-canvas');
  await canvas.click({ position: { x: 120, y: 380 } });
  await canvas.click({ position: { x: 420, y: 380 } });
  await expect(walls).toHaveCount(7);

  await page.getByRole('button', { name: 'Calculs', exact: true }).click();
  await expect(page.locator('.dashboard-card').first()).toBeVisible();
  await expect(page.locator('.badge.status-error')).toHaveCount(0);
  await expect(page.locator('.badge.status-failed')).toHaveCount(0);

  // The container is written with the compression the browser provides and
  // read back by the same reader: an engine without it would fail here.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Sauvegarder' }).click();
  const saved = await (await download).path();
  expect(saved).not.toBeNull();
  await expect(page.getByRole('status')).toContainText('.houseproj');

  await page.reload();
  const prompt = page.getByRole('alertdialog');
  if ((await prompt.count()) > 0)
    await prompt.getByRole('button', { name: 'Ignorer et supprimer' }).click();
  await page.setInputFiles('input[type="file"]', saved);
  await expect(page.getByRole('status')).toContainText('chargé et validé');
  await expect(walls).toHaveCount(7);

  expect(errors).toEqual([]);
});

test('keeps a local snapshot across a reload on this engine', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Maison de démonstration' }).click();
  await expect(page.getByRole('status')).toContainText('démonstration');
  await page.getByRole('button', { name: 'Mur', exact: true }).click();
  const canvas = page.locator('.plan-canvas');
  await canvas.click({ position: { x: 140, y: 300 } });
  await canvas.click({ position: { x: 440, y: 300 } });
  // The snapshot is written after a delay; the state label says when it is out.
  await expect(page.locator('.save-state')).toHaveText(
    'Sauvegardé localement · export nécessaire',
    { timeout: 15_000 },
  );

  await page.reload();
  const prompt = page.getByRole('alertdialog');
  await expect(prompt).toContainText('sauvegarde locale');
  await prompt.getByRole('button', { name: 'Restaurer' }).click();
  await expect(page.locator('[data-role="WALL_CUT"][id^="wall:"]')).toHaveCount(
    7,
  );
});
