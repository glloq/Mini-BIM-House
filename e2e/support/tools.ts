import type { Locator, Page } from '@playwright/test';

/**
 * Choisir un outil, comme une personne le fait.
 *
 * La sous-partie met une poignée d'entrées sous la main ; les autres
 * sous-parties sont à un clic de la rangée, et le reste du registre à un
 * dépliage, sur le même écran. Il n'y a toujours pas de mode « simple » et de mode
 * « expert » à changer : un test ouvre le dépliage, il ne change pas de
 * produit.
 *
 * Une entrée porte le nom de ce qu'elle pose — « Porte », « WC », « Prise » —
 * et l'outil du registre porte le sien. Les deux se cherchent ici de la même
 * façon : ce que quelqu'un lit dans la colonne.
 */
export async function revealAllTools(page: Page): Promise<void> {
  const more = page.locator(
    '.tool-header details.tool-more:not([open]) > summary',
  );
  if ((await more.count()) > 0) await more.first().click();
}

export async function chooseTool(page: Page, label: string): Promise<void> {
  const toolbox = page.locator('.tool-header');
  const offered = toolbox.getByRole('button', { name: label, exact: true });
  if ((await offered.count()) === 0) {
    // Une sous-partie à la fois : l'outil est peut-être dans une autre, et
    // c'est un clic de la rangée, pas un dépliage.
    const row = page.getByRole('navigation', { name: 'Sous-parties' });
    const parts = row.getByRole('button');
    for (let index = 0; index < (await parts.count()); index += 1) {
      await parts.nth(index).click();
      if ((await offered.count()) > 0) break;
    }
  }
  if ((await offered.count()) === 0) await revealAllTools(page);
  await toolbox.getByRole('button', { name: label, exact: true }).click();
}

/** Ouvrir une sous-partie de l'espace courant, par son nom. */
export async function openSection(page: Page, label: string): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Sous-parties' })
    .getByRole('button', { name: label, exact: true })
    .click();
}

/**
 * Le bouton d'un outil dans la rangée, et pas ailleurs.
 *
 * Le même outil est désormais écrit à deux endroits : la rangée, qu'on prend
 * sans lire, et le panneau « Ajouter », qui montre tout ce que la sous-partie
 * sait poser. C'est voulu — mais un test qui demande « le bouton Mur » en
 * trouve deux. Celui de la rangée est celui dont on parle quand on parle de
 * l'outil actif.
 */
export function toolButton(page: Page, label: string): Locator {
  return page
    .locator('.tool-header')
    .getByRole('button', { name: label, exact: true });
}
