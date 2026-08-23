import type { Page } from '@playwright/test';

/**
 * Choisir un outil, comme une personne le fait.
 *
 * L'étape met une dizaine d'entrées sous la main ; le reste est à un dépliage,
 * sur le même écran. Il n'y a toujours pas de mode « simple » et de mode
 * « expert » à changer : un test ouvre le dépliage, il ne change pas de
 * produit.
 *
 * Une entrée porte le nom de ce qu'elle pose — « Porte », « WC », « Prise » —
 * et l'outil du registre porte le sien. Les deux se cherchent ici de la même
 * façon : ce que quelqu'un lit dans la colonne.
 */
export async function revealAllTools(page: Page): Promise<void> {
  const panel = page.locator('.toolbox');
  const disclosures = panel.locator(
    'details.toolbox-others:not([open]) summary',
  );
  for (let index = 0; index < (await disclosures.count()); index += 1)
    await disclosures.nth(index).click();
}

export async function chooseTool(page: Page, label: string): Promise<void> {
  const toolbox = page.locator('.toolbox');
  const offered = toolbox.getByRole('button', { name: label, exact: true });
  if ((await offered.count()) === 0) await revealAllTools(page);
  await toolbox.getByRole('button', { name: label, exact: true }).click();
}
