import type { Locator, Page } from '@playwright/test';

import { openStage } from './navigation.js';
import { openTools } from './panels.js';

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
  /*
   * La colonne montre une chose à la fois : ce qu'on pose, ou ce qu'on a
   * désigné. Elle passe aux propriétés dès qu'on désigne un objet — c'est ce
   * que faisait le panneau de droite, qui paraissait tout seul — et reprendre
   * un outil demande donc de redire qu'on vient poser. Une personne clique
   * « Outils » ; le test aussi.
   */
  await openTools(page);
  // Le dépliage laissé ouvert par la recherche précédente couvre la rangée des
  // sous-parties : on cherche dans un écran qu'on a soi-même masqué.
  const open = page.locator('.tool-header details.tool-more[open] > summary');
  if ((await open.count()) > 0) await open.first().click();
  if ((await offered.count()) > 0) return true;
  const row = page.getByRole('navigation', { name: 'Sous-parties' });
  // Les sous-parties sont un sommaire dépliable dans la colonne : on ouvre
  // celle qu'on veut, et ce qu'elle pose apparaît dessous.
  const parts = row.locator('details.section-fold > summary');
  for (let index = 0; index < (await parts.count()); index += 1) {
    await parts.nth(index).click();
    if ((await offered.count()) > 0) return true;
  }
  await revealAllTools(page);
  return (await offered.count()) > 0;
}

export async function chooseTool(page: Page, label: string): Promise<void> {
  // Les outils vivent dans le sommaire de la colonne ; la rangée au-dessus du
  // plan ne garde que la Sélection, l'outil en cours et les gestes communs.
  const toolbox = page.locator('#workspace-sidebar, .tool-header');
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

/**
 * Ouvrir une sous-partie de l'espace courant, par son nom.
 *
 * C'est un dépliage et non un bouton : la rangée au-dessus du plan est
 * devenue un sommaire dans la colonne, où l'ouverte montre ce qu'elle pose.
 */
export async function openSection(page: Page, label: string): Promise<void> {
  const summary = page
    .getByRole('navigation', { name: 'Sous-parties' })
    .getByLabel(label, { exact: true });
  if ((await summary.getAttribute('aria-current')) !== 'true')
    await summary.click();
}

/**
 * Le bouton d'un outil, là où il se trouve.
 *
 * Les outils vivent dans le sommaire de la colonne ; la rangée au-dessus du
 * plan ne garde que la Sélection, l'outil en cours et les gestes communs. Un
 * test qui demande « le bouton Mur » cherche donc les deux, et prend celui
 * qu'on voit.
 */
export function toolButton(page: Page, label: string): Locator {
  return page
    .locator('#workspace-sidebar, .tool-header')
    .getByRole('button', { name: label, exact: true })
    .locator('visible=true')
    .first();
}
