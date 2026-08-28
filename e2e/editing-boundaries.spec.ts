import { expect, test, type Page } from '@playwright/test';

import { fileAction } from './support/file-menu.js';
import { openStage } from './support/navigation.js';
import { openModelTree } from './support/panels.js';

/**
 * Les frontières d'édition, prises par le chemin qui les contournait.
 *
 * Un objet appartient à un espace et ne se modifie que là. La règle est tenue
 * par `ProjectEditingSession.dispatch`, et `apps/web/src/editing-boundary.test.ts`
 * la vérifie sur ce passage. Ce fichier-ci vérifie autre chose : qu'aucun
 * chemin de l'interface n'y échappe.
 *
 * Le chemin choisi est **l'arborescence du projet**, parce que c'est
 * précisément celui qui contournait le seul verrou qui existait avant. Le clic
 * sur le plan était filtré par `selectableInStage` ; l'arborescence, elle,
 * désigne n'importe quel objet depuis n'importe quel espace. Sélectionner une
 * parcelle depuis Bâtiment puis appuyer sur `Delete` était donc possible, et
 * c'est exactement ce que ces tests refont.
 *
 * Sélectionner reste permis, et doit le rester : c'est ce qui permet à un
 * constat thermique de mener au mur dont il parle. C'est **écrire** qui est
 * refusé.
 */

async function demo(page: Page): Promise<void> {
  await page.goto('/');
  await fileAction(page, 'Maison de démonstration');
  await expect(page.getByRole('status')).toContainText('démonstration');
}

/**
 * Ramener l'espace ouvert sur son plan.
 *
 * L'arborescence vit sous le dessin. Études ouvre sur la vue d'ensemble et
 * Documents sur la table des feuilles : les deux atteignent le plan, mais ce
 * n'est pas là qu'ils arrivent. Il faut donc y aller, sans changer d'espace —
 * un test qui ferait « ouvrir la destination Plan » basculerait vers Bâtiment
 * et testerait le contraire de ce qu'il croit.
 */
async function showPlan(page: Page): Promise<void> {
  const plan = page
    .locator('#workspace-sidebar')
    .getByRole('button', { name: 'Plan', exact: true });
  if ((await plan.count()) > 0) await plan.first().click();
}

/** Désigner un objet par l'arborescence, quel que soit l'espace ouvert. */
async function selectInTree(
  page: Page,
  fold: RegExp,
  object: RegExp,
): Promise<void> {
  await showPlan(page);
  await openModelTree(page);
  const tree = page.getByRole('navigation', {
    name: 'Arborescence du projet',
  });
  const summary = tree.locator('summary').filter({ hasText: fold }).first();
  await summary.click();
  await tree.getByRole('button', { name: object }).first().click();
}

const TREE = { walls: /^Murs/u, site: /^Terrain/u };

test('the site deletes its own tree, and says so', async ({ page }) => {
  await demo(page);
  await openStage(page, 'Terrain');
  await selectInTree(page, TREE.site, /^Chêne$/u);
  await page.keyboard.press('Delete');
  await expect(page.getByRole('status')).toContainText('appliqué');
});

test('the building may not delete what the site owns', async ({ page }) => {
  await demo(page);
  await openStage(page, 'Bâtiment');
  // L'arborescence désigne l'arbre sans difficulté : c'est voulu, on doit
  // pouvoir le trouver et le lire depuis n'importe où.
  await selectInTree(page, TREE.site, /^Chêne$/u);
  await page.keyboard.press('Delete');
  // Mais le geste destructeur est refusé, et le refus dit où aller.
  await expect(page.getByRole('status')).toContainText('appartient à Terrain');
});

test('the building deletes its own wall', async ({ page }) => {
  await demo(page);
  await openStage(page, 'Bâtiment');
  await selectInTree(page, TREE.walls, /wall-east/u);
  await page.keyboard.press('Delete');
  await expect(page.getByRole('status')).toContainText('appliqué');
});

test('the systems may not delete a wall they merely route against', async ({
  page,
}) => {
  await demo(page);
  await openStage(page, 'Systèmes');
  await selectInTree(page, TREE.walls, /wall-east/u);
  await page.keyboard.press('Delete');
  await expect(page.getByRole('status')).toContainText('appartient à Bâtiment');
});

test('the two reading stages write nothing at all', async ({ page }) => {
  /*
   * Études ouvre un constat sur son objet et Documents met n'importe quoi sur
   * une feuille : les deux désignent tout, et ne modifient rien. C'est la
   * moitié de la règle qui se voit le moins, et celle qu'un raccourci clavier
   * traverse le plus facilement.
   */
  for (const stage of ['Études', 'Documents']) {
    await demo(page);
    await openStage(page, stage);
    await selectInTree(page, TREE.walls, /wall-east/u);
    await page.keyboard.press('Delete');
    await expect(page.getByRole('status'), stage).toContainText(
      'appartient à Bâtiment',
    );
  }
});
