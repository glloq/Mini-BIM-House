import { expect, test, type Page } from '@playwright/test';

import { loadDemoProject } from './support/file-menu.js';
import { openStage } from './support/navigation.js';
import { openModelTree } from './support/panels.js';
import { chooseTool } from './support/tools.js';

/**
 * Deux gestes neufs, éprouvés là où ils vivent.
 *
 * Les deux sont couverts par des tests unitaires qui les font tourner sur la
 * maison de référence. Ça ne dit pas qu'on peut les atteindre : le premier
 * était complet et n'apparaissait dans aucune boîte à outils, faute d'une
 * entrée dans le sommaire. Un geste qu'on ne peut pas prendre n'existe pas, et
 * c'est le genre de trou qu'aucun test unitaire ne voit.
 */

async function demo(page: Page): Promise<void> {
  await page.goto('/');
  await loadDemoProject(page);
  await expect(page.locator('[id^="wall:"]').first()).toBeVisible();
}

/** Le ballon d'eau chaude, désigné sur le plan de l'espace qui le possède. */
async function pickTank(page: Page): Promise<void> {
  const canvas = page.locator('.plan-canvas');
  const frame = (await canvas.boundingBox())!;
  const drawn = (await page
    .locator('[id^="component:component-dhw-tank"]')
    .first()
    .boundingBox())!;
  await canvas.click({
    position: {
      x: drawn.x - frame.x + drawn.width / 2,
      y: drawn.y - frame.y + drawn.height / 2,
    },
  });
}

test('raccorde un appareil à ses réseaux d’un seul geste', async ({ page }) => {
  await demo(page);
  await openStage(page, 'Systèmes');

  /*
   * Ce que coûtait ce raccordement : onze gestes et trois entrées
   * d'historique. Armer l'outil réseau, choisir le réseau, choisir le type de
   * nœud, cliquer ; armer « Dériver », cliquer ; armer « Tracer un tronçon »,
   * rechoisir le réseau, cliquer le départ, le coude, l'arrivée. Il en reste
   * un, et la barre dit d'avance ce qu'il fera.
   */
  await pickTank(page);
  const connect = page
    .getByRole('group', { name: 'Actions du contexte' })
    .getByRole('button', { name: /Raccorder/u });
  await expect(connect).toBeEnabled();
  await connect.click();
  await expect(page.getByRole('status')).toContainText('appliqué');
});

test('refuse de répéter depuis un espace qui ne possède pas l’objet', async ({
  page,
}) => {
  await demo(page);
  await openStage(page, 'Bâtiment');
  await chooseTool(page, 'Répéter');

  /*
   * L'outil est commun aux sept espaces — comme Pivoter et Miroir — mais ce
   * qu'il pose ne l'est pas. Répéter un appareil depuis le bâtiment se refuse
   * comme le reste, et le refus nomme l'espace où le geste est permis : c'est
   * la même frontière qui protège déjà le clic, la poignée et l'inspecteur.
   */
  const canvas = page.locator('.plan-canvas');
  const frame = (await canvas.boundingBox())!;
  const drawn = (await page
    .locator('[id^="component:component-dhw-tank"]')
    .first()
    .boundingBox())!;
  const at = {
    x: drawn.x - frame.x + drawn.width / 2,
    y: drawn.y - frame.y + drawn.height / 2,
  };
  await canvas.click({ position: at });
  await canvas.click({ position: { x: at.x + 25, y: at.y } });
  await expect(page.getByRole('status')).toContainText('appartient à Systèmes');
});

test('répète un objet du bâtiment, dans le bâtiment', async ({ page }) => {
  await demo(page);
  await openStage(page, 'Bâtiment');
  await openModelTree(page);
  const walls = await page.locator('[id^="wall:"]').count();
  await page
    .getByRole('dialog', { name: 'Éléments du projet' })
    .getByRole('button', { name: 'Fermer' })
    .click();

  await chooseTool(page, 'Répéter');
  const canvas = page.locator('.plan-canvas');
  const frame = (await canvas.boundingBox())!;
  const wall = (await page.locator('[id^="wall:"]').first().boundingBox())!;
  const at = {
    x: wall.x - frame.x + wall.width / 2,
    y: wall.y - frame.y + wall.height / 2,
  };
  await canvas.click({ position: at });
  await canvas.click({ position: { x: at.x, y: at.y + 30 } });

  // Trois copies par défaut : le nombre se règle dans la barre de l'outil, et
  // ce qu'on obtient est ce que le fantôme annonçait.
  await expect(page.locator('[id^="wall:"]')).toHaveCount(walls + 3);
});
