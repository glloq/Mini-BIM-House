import { expect, test, type Page } from '@playwright/test';

import { loadDemoProject } from './support/file-menu.js';
import {
  countGestures,
  expectGestures,
  startCounting,
} from './support/gestures.js';
import { openStage, workspaceReady } from './support/navigation.js';
import { openTools } from './support/panels.js';
import { openSection, toolButton } from './support/tools.js';

/**
 * Ce que coûtent les intentions les plus fréquentes.
 *
 * Le reste de la suite dit qu'une chose est **possible**. Aucun test ne disait
 * ce qu'elle **coûte**, et c'est pourtant là que l'ergonomie se perd : poser
 * une porte reste « possible » quand il faut sept gestes pour y arriver, et
 * une suite entièrement verte ne s'en aperçoit pas. Une régression
 * d'ergonomie n'échoue nulle part — c'est ce qui la rend si facile à
 * accumuler.
 *
 * Chaque test suit le **chemin direct**, celui de quelqu'un qui sait où va
 * l'outil, et plafonne le nombre de gestes réellement reçus par la page.
 * Ajouter une confirmation, un panneau à rouvrir, un onglet à reprendre fera
 * échouer l'intention concernée, avec le relevé geste par geste.
 *
 * Les budgets sont relevés sur l'écran tel qu'il est, pas souhaités. Les
 * baisser est le travail ; les monter est une décision qu'on écrit.
 */

const CANVAS = '.plan-canvas';

async function fresh(page: Page): Promise<void> {
  await countGestures(page);
  await page.goto('/');
  await workspaceReady(page);
  await startCounting(page);
}

async function demo(page: Page): Promise<void> {
  await countGestures(page);
  await page.goto('/');
  await loadDemoProject(page);
  await expect(page.locator('[id^="wall:"]').first()).toBeVisible();
  await startCounting(page);
}

/** Un point du plan, en fractions, pour ne pas dépendre de sa taille. */
async function at(
  page: Page,
  x: number,
  y: number,
): Promise<{ x: number; y: number }> {
  const box = (await page.locator(CANVAS).boundingBox())!;
  return { x: box.width * x, y: box.height * y };
}

test('tracer un mur dans un projet neuf', async ({ page }) => {
  await fresh(page);

  // L'espace, l'outil, le départ, l'extrémité. Il n'y a rien d'autre à faire,
  // et rien d'autre ne doit s'intercaler : ni assistant, ni niveau à créer,
  // ni panneau à reprendre.
  await openStage(page, 'Bâtiment');
  await openTools(page);
  await openSection(page, 'Murs');
  await toolButton(page, 'Mur').click();
  const canvas = page.locator(CANVAS);
  await canvas.click({ position: await at(page, 0.3, 0.4) });
  await canvas.click({ position: await at(page, 0.7, 0.4) });

  await expect(page.locator('[id^="wall:"]')).toHaveCount(1);
  await expectGestures(page, 'tracer un mur dans un projet neuf', 4);
});

test('poser une porte dans un mur existant', async ({ page }) => {
  await demo(page);
  const before = await page.locator('[id^="opening:"]').count();

  await openStage(page, 'Bâtiment');
  await openTools(page);
  await openSection(page, 'Ouvertures');
  await toolButton(page, 'Porte').click();
  // Une porte se pose **sur** un mur : on désigne le mur, pas un point du vide.
  await page.locator('[id^="wall:"]').first().click({ force: true });

  await expect(page.locator('[id^="opening:"]')).toHaveCount(before + 1);
  await expectGestures(page, 'poser une porte dans un mur existant', 4);
});

test('corriger la longueur d’un mur', async ({ page }) => {
  await demo(page);

  /*
   * Désigner, puis dire la valeur. Deux gestes.
   *
   * La colonne passe aux propriétés d'elle-même : c'est ce qui fait tenir
   * cette intention en deux gestes plutôt qu'en quatre, et c'est exactement ce
   * qu'un budget protège — le jour où il faudra rouvrir un onglet, ce test le
   * dira.
   */
  await page.locator('[id^="wall:"]').first().click({ force: true });
  // La longueur et non l'épaisseur : l'épaisseur d'un mur vient de son
  // assemblage et se lit, elle ne se saisit pas. C'est une décision du modèle,
  // pas un manque, et un test d'ergonomie n'a pas à la contester.
  // Deux champs disent la longueur : celui de l'inspecteur et celui que le
  // plan pose à côté de la sélection. On mesure le premier — c'est là qu'on
  // corrige ce qui existe ; l'autre sert à poser.
  const length = page.locator('#inspector-lengthMm');
  await length.fill('7500');
  await length.press('Enter');

  await expect(length).toHaveValue('7500');
  await expectGestures(page, 'corriger la longueur d’un mur', 2);
});

test('tracer une parcelle', async ({ page }) => {
  await fresh(page);

  await openStage(page, 'Terrain');
  await openTools(page);
  await toolButton(page, 'Parcelle').click();
  const canvas = page.locator(CANVAS);
  for (const [x, y] of [
    [0.25, 0.35],
    [0.7, 0.35],
    [0.7, 0.75],
    [0.25, 0.75],
  ] as const)
    await canvas.click({ position: await at(page, x, y) });
  await page.getByRole('button', { name: 'Fermer la surface' }).first().click();

  await expect(page.locator('[id="site:parcel"]')).toHaveCount(1);
  // Quatre sommets et la fermeture sont irréductibles ; l'espace et l'outil
  // sont les deux seuls gestes de navigation qu'on accepte devant.
  await expectGestures(page, 'tracer une parcelle à quatre coins', 7);
});

test('poser un meuble dans une pièce', async ({ page }) => {
  await demo(page);
  const before = await page.locator('[id^="component:"]').count();

  // L'aménagement ne se range pas en sous-parties : ce qu'on pose est nommé
  // par ce que c'est, et un lit se prend directement.
  await openStage(page, 'Aménagement');
  await openTools(page);
  await toolButton(page, 'Lit').click();
  await page.locator(CANVAS).click({ position: await at(page, 0.4, 0.45) });

  await expect(page.locator('[id^="component:"]')).toHaveCount(before + 1);
  await expectGestures(page, 'poser un meuble dans une pièce', 3);
});
