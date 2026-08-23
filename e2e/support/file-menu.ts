import type { Page } from '@playwright/test';

/**
 * Ce qu'on fait au fichier, replié sous « Fichier ▾ ».
 *
 * Nouveau, ouvrir, la maison de démonstration, sauvegarder et les deux exports
 * étaient six boutons permanents de la barre supérieure ; ils sont maintenant
 * un menu. Un test l'ouvre comme une personne l'ouvre — et c'est bien le sujet
 * du test que ces six gestes restent atteignables à la souris seule.
 */
export async function fileAction(page: Page, label: string): Promise<void> {
  const opener = page.getByRole('button', { name: 'Fichier' });
  if ((await opener.getAttribute('aria-expanded')) !== 'true')
    await opener.click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
}

/** La maison de démonstration, chargée depuis le menu. */
export async function loadDemoProject(page: Page): Promise<void> {
  await fileAction(page, 'Maison de démonstration');
}
