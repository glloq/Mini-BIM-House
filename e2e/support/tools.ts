import type { Locator, Page } from '@playwright/test';

import { openStage } from './navigation.js';

/** Les sept espaces, dans l'ordre de la barre. */
const SPACES = [
  'Projet',
  'Terrain',
  'Bâtiment',
  'Aménagement',
  'Systèmes',
  'Études',
  'Documents',
] as const;

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

/** Parcourir les sous-parties de l'espace ouvert, jusqu'à trouver l'outil. */
/**
 * Ramener cet espace sur son plan.
 *
 * Chaque espace se souvient de la destination qu'on y avait ouverte : revenir
 * dans « Systèmes » après y avoir consulté la table des réseaux rouvre la
 * table, pas le dessin. Les outils vivent sur le dessin.
 */
async function showPlan(page: Page): Promise<void> {
  if (await page.locator('.tool-header').isVisible()) return;
  const plan = page
    .locator('#workspace-sidebar')
    .getByRole('button', { name: 'Plan', exact: true });
  if ((await plan.count()) > 0) await plan.first().click();
}

async function sweepSections(page: Page, offered: Locator): Promise<boolean> {
  await showPlan(page);
  // Le dépliage laissé ouvert par la recherche précédente couvre la rangée des
  // sous-parties : on cherche dans un écran qu'on a soi-même masqué.
  const open = page.locator('.tool-header details.tool-more[open] > summary');
  if ((await open.count()) > 0) await open.first().click();
  if ((await offered.count()) > 0) return true;
  const row = page.getByRole('navigation', { name: 'Sous-parties' });
  const parts = row.getByRole('button');
  for (let index = 0; index < (await parts.count()); index += 1) {
    await parts.nth(index).click();
    if ((await offered.count()) > 0) return true;
  }
  await revealAllTools(page);
  return (await offered.count()) > 0;
}

export async function chooseTool(page: Page, label: string): Promise<void> {
  const toolbox = page.locator('.tool-header');
  /*
   * Ce qu'on voit, et non ce que le document contient.
   *
   * Le contenu d'un `<details>` fermé est dans la page : compter les boutons
   * sans regarder s'ils sont visibles faisait croire l'outil trouvé alors que
   * le dépliage était clos, et le clic attendait un bouton que personne ne
   * voyait. Une personne cherche des yeux.
   */
  const offered = toolbox
    .getByRole('button', { name: label, exact: true })
    .locator('visible=true');
  /*
   * Les sept espaces sont séparés : le « + » ne verse plus les outils des six
   * autres. Un outil se cherche donc là où il vit — dans son espace, puis dans
   * sa sous-partie — et c'est ce que fait quelqu'un qui lit la barre du haut.
   */
  if (!(await sweepSections(page, offered)))
    for (const space of SPACES) {
      await openStage(page, space);
      if (await sweepSections(page, offered)) break;
    }
  // Le même nom peut être sous la main **et** dans le dépliage : c'est le
  // même bouton montré deux fois, et celui de la rangée est le plus proche.
  await offered.first().click();
  // Choisir referme le dépliage — c'est ce que fait l'écran, et un test qui
  // le laisse ouvert clique ensuite à travers un menu posé sur le plan.
  const open = page.locator('.tool-header details.tool-more[open] > summary');
  if ((await open.count()) > 0) await open.first().click();
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
