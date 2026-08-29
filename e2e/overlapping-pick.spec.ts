import { expect, test } from '@playwright/test';

import { fileAction } from './support/file-menu.js';

/**
 * Ce qu'il y a sous le clic, quand il y a plusieurs choses.
 *
 * Le cycle existait et marchait : recliquer au même endroit prend l'objet
 * suivant. Il ne se voyait pas — son état vivait dans un `ref`, que rien ne
 * rend — et une fonction qu'on ne peut découvrir qu'en recliquant par hasard
 * au même pixel n'est pas une fonction découvrable.
 *
 * Mesuré sur la maison de référence, sur une grille de trois mille deux cent
 * quarante-neuf points qui touchent quelque chose : **dix-huit pour cent des
 * clics utiles sont ambigus**, et jusqu'à huit objets peuvent se trouver sous
 * un même point. Un clic sur cinq, pas un cas rare.
 */
test('names what lies under an ambiguous click, and lets one be chosen', async ({
  page,
}) => {
  await page.goto('/');
  await fileAction(page, 'Maison de démonstration');
  await expect(page.getByRole('status')).toContainText('démonstration');

  // Un mur qui porte une ouverture : deux objets au même endroit, et c'est le
  // cas le plus banal d'une maison dessinée.
  const canvas = page.locator('.plan-canvas');
  const frame = (await canvas.boundingBox())!;
  const wall = (await page.locator('[id="wall:wall-south"]').boundingBox())!;
  await canvas.click({
    position: {
      x: wall.x - frame.x + wall.width * 0.25,
      y: wall.y - frame.y + wall.height / 2,
    },
  });

  const choices = page.locator('.pick-choices');
  await expect(choices).toBeVisible();
  const rows = choices.getByRole('button');
  expect(await rows.count()).toBeGreaterThan(1);

  // Un seul est marqué comme pris, et c'est celui que l'inspecteur montre.
  const current = choices.locator('button.chosen');
  await expect(current).toHaveCount(1);
  const taken = (await current.textContent())!.trim();
  await expect(page.locator('.inspector-subject')).toContainText(taken);

  // Et choisir une autre ligne prend cet objet-là, sans compter les clics.
  const others = choices.locator('button:not(.chosen)');
  const wanted = (await others.first().textContent())!.trim();
  await others.first().click();
  await expect(page.locator('.inspector-subject')).toContainText(wanted);
});

test('says nothing when a click is not ambiguous', async ({ page }) => {
  // Une liste d'un élément est un panneau qui coûte un clic pour ne rien dire.
  await page.goto('/');
  await fileAction(page, 'Maison de démonstration');
  await expect(page.getByRole('status')).toContainText('démonstration');
  const canvas = page.locator('.plan-canvas');
  await canvas.click({ position: { x: 4, y: 4 } });
  await expect(page.locator('.pick-choices')).toHaveCount(0);
});
