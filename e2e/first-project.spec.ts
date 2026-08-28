import { expect, test } from '@playwright/test';

import { fileAction } from './support/file-menu.js';
import { openDestination } from './support/navigation.js';

/**
 * Le premier écran de quelqu'un qui vient d'ouvrir l'application.
 *
 * Un projet neuf arrive sur « Vérifications » avec quarante-sept constats.
 * Aucun n'est un défaut — ce sont tous des « non vérifiable » — et
 * trente-neuf de leurs boutons mènent aux réglages de calcul, au jeu
 * climatique ou aux équipements. Aucun réglage ne calcule quoi que ce soit sur
 * un fichier qui n'a ni mur, ni pièce, ni réseau : renseigner le nombre
 * d'occupants d'une maison sans pièce ne rapproche de rien.
 *
 * Les constats restent affichés — cacher ce que l'application sait serait
 * l'erreur inverse — mais le premier geste est nommé avant eux.
 */
test('a new project is told to draw before it is told what is missing', async ({
  page,
}) => {
  await page.goto('/');
  await openDestination(page, 'Vérifications');

  const opening = page.locator('.canvas-panel .empty-state').first();
  await expect(opening).toContainText('ne contient encore aucun objet');
  await expect(opening).toContainText('c’est de dessiner');

  // Et le geste nommé est à un clic, sur cet écran.
  await opening.getByRole('button', { name: 'Ouvrir le plan' }).click();
  await expect(page.locator('.plan-canvas')).toBeVisible();
});

test('a project that holds something is not told that', async ({ page }) => {
  await page.goto('/');
  await fileAction(page, 'Maison de démonstration');
  await expect(page.getByRole('status')).toContainText('démonstration');
  await openDestination(page, 'Vérifications');

  // La maison de démonstration contient des murs : lui dire de commencer par
  // dessiner serait le même défaut, dans l'autre sens.
  await expect(
    page.locator('.canvas-panel').getByText('ne contient encore aucun objet'),
  ).toHaveCount(0);
});
