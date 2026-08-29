import { expect, test } from '@playwright/test';

import { loadDemoProject } from './support/file-menu.js';

/**
 * L'étiquette d'une pièce se déplace, et se remet.
 *
 * Elle se pose toute seule au point le plus au large du contour — le point le
 * plus éloigné de tout bord, qui laisse le plus de place au texte. C'est le
 * bon défaut et il est mesuré : sur la maison de référence, quatre étiquettes
 * sur quatre tombent malgré tout sur le symbole d'un luminaire de plafond, et
 * ce n'est pas un hasard — un luminaire se pose au centre de la pièce, et le
 * point le plus au large d'une pièce rectangulaire est le centre. La
 * collision est structurelle.
 *
 * D'où le geste : prendre l'étiquette et la poser ailleurs. Ce qui est gardé
 * est un **écart**, jamais une position, pour qu'un mur déplacé emmène
 * l'étiquette avec lui — c'est vérifié sur le modèle. Ce test-ci vérifie
 * l'autre moitié, celle qu'aucun test de modèle ne voit : que le geste existe
 * à l'écran, qu'il s'annule, et qu'on peut revenir au calcul.
 */
test('déplace l’étiquette d’une pièce, l’annule, puis la replace', async ({
  page,
}) => {
  await page.goto('/');
  await loadDemoProject(page);
  await expect(page.locator('[id^="wall:"]').first()).toBeVisible();

  const label = page.locator('.room-label-movable').first();
  await expect(label).toBeVisible();
  // Aucune n'est déplacée au départ : l'absence d'écart est ce que dit un
  // projet où personne n'a rien décidé.
  await expect(page.locator('.room-label-moved')).toHaveCount(0);

  const before = (await label.boundingBox())!;
  await page.mouse.move(
    before.x + before.width / 2,
    before.y + before.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(before.x + 140, before.y + 70, { steps: 10 });
  await page.mouse.up();

  await expect(page.getByRole('status')).toContainText('appliqué');
  const moved = (await label.boundingBox())!;
  expect(moved.x - before.x).toBeGreaterThan(80);
  // Et elle dit qu'elle a été placée à la main : sans ce signe, on la croirait
  // mal calculée et on la déplacerait encore.
  await expect(page.locator('.room-label-moved')).toHaveCount(1);

  // Une seule entrée d'historique : un déplacement s'annule d'un seul coup.
  await page.keyboard.press('Control+z');
  await expect(page.locator('.room-label-moved')).toHaveCount(0);
  expect((await label.boundingBox())!.x).toBeCloseTo(before.x, 0);

  // Refait, puis remis au calcul par le même geste qui retire un sommet.
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('.room-label-moved')).toHaveCount(1);
  await label.click({ modifiers: ['Alt'] });
  await expect(page.locator('.room-label-moved')).toHaveCount(0);
  expect((await label.boundingBox())!.x).toBeCloseTo(before.x, 0);
});
