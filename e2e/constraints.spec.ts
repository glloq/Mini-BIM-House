import { expect, test, type Page } from '@playwright/test';

import { loadDemoProject } from './support/file-menu.js';
import { openStage, workspaceReady } from './support/navigation.js';
import { openTools } from './support/panels.js';
import { openSection, toolButton } from './support/tools.js';

/**
 * Les deux touches qu'on tient en dessinant.
 *
 * `Maj` faisait glisser le plan. C'est, partout ailleurs, la touche qui
 * contraint — on la tient pour forcer un trait droit — si bien que le geste
 * le plus courant du dessin faisait fuir le dessin sous la main, et que rien
 * à l'écran ne l'annonçait. Le panoramique est passé sur la barre d'espace et
 * le bouton du milieu, qui sont ses gestes ; `Maj` inverse la contrainte
 * d'angle, le temps d'un segment.
 *
 * Ces tests figent les deux, parce qu'une touche tenue ne laisse aucune trace
 * dans le modèle : le seul moyen de savoir qu'elle a servi est de regarder ce
 * qui a été dessiné.
 */

/** Un mur de sept degrés : franchement oblique, et pas un multiple du pas. */
const OBLIQUE_PX = { dx: 400, dy: 49 };

async function wallTool(page: Page): Promise<void> {
  await page.goto('/');
  await workspaceReady(page);
  await openStage(page, 'Bâtiment');
  await openTools(page);
  await openSection(page, 'Murs');
  await toolButton(page, 'Mur').click();
}

/** Trace un mur oblique, la touche tenue ou non, et rend sa boîte. */
async function obliqueWall(
  page: Page,
  options: { readonly holdingShift: boolean },
): Promise<{ readonly width: number; readonly height: number }> {
  const canvas = page.locator('.plan-canvas');
  const box = (await canvas.boundingBox())!;
  const from = { x: box.width * 0.3, y: box.height * 0.5 };
  const to = { x: from.x + OBLIQUE_PX.dx, y: from.y + OBLIQUE_PX.dy };
  await canvas.click({ position: from });
  if (options.holdingShift) await page.keyboard.down('Shift');
  // Un survol avant le clic : c'est le mouvement qui met l'aperçu à jour, et
  // l'aperçu est ce que le clic doit poser — le fichier a déjà payé une fois
  // le prix de deux lectures du même geste.
  await canvas.hover({ position: to });
  await canvas.click({ position: to });
  if (options.holdingShift) await page.keyboard.up('Shift');
  const wall = page.locator('[id^="wall:"]').first();
  await expect(wall).toBeAttached();
  const drawn = (await wall.boundingBox())!;
  return { width: drawn.width, height: drawn.height };
}

test('sans Maj, un mur presque horizontal le devient tout à fait', async ({
  page,
}) => {
  await wallTool(page);
  const drawn = await obliqueWall(page, { holdingShift: false });
  // Sept degrés arrondis au pas de quinze : le mur est horizontal, et sa
  // hauteur à l'écran n'est plus que son épaisseur.
  expect(drawn.height).toBeLessThan(OBLIQUE_PX.dy / 2);
});

test('Maj tenue garde l’angle qu’on vise, et ne fait rien glisser', async ({
  page,
}) => {
  await wallTool(page);
  const drawn = await obliqueWall(page, { holdingShift: true });
  /*
   * La pente est là, et c'est tout ce qu'on demande.
   *
   * Pas une égalité au pixel : le mur a une épaisseur, ses bouts sont coupés
   * d'équerre, et sa boîte est un peu plus haute que la seule dénivelée. Ce
   * qui se joue est le passage de « rien » à « la pente visée », et une marge
   * de moitié le dit sans dépendre du dessin des about.
   */
  expect(drawn.height).toBeGreaterThan(OBLIQUE_PX.dy / 2);
});

test('la barre d’espace fait glisser le plan, Maj ne le fait plus', async ({
  page,
}) => {
  await page.goto('/');
  await loadDemoProject(page);
  const wall = page.locator('[id^="wall:"]').first();
  await expect(wall).toBeVisible();
  const canvas = page.locator('.plan-canvas');
  const frame = (await canvas.boundingBox())!;
  const before = (await wall.boundingBox())!;

  const from = {
    x: frame.x + frame.width * 0.5,
    y: frame.y + frame.height * 0.8,
  };
  const to = { x: from.x + 120, y: from.y - 60 };
  const drag = async (): Promise<void> => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
  };

  // `Maj` tirée à travers le plan : elle désigne, elle ne déplace rien.
  await page.keyboard.down('Shift');
  await drag();
  await page.keyboard.up('Shift');
  const afterShift = (await wall.boundingBox())!;
  expect(afterShift.x).toBeCloseTo(before.x, 0);
  expect(afterShift.y).toBeCloseTo(before.y, 0);

  // La barre d'espace, elle, fait glisser — et le curseur le dit avant même
  // qu'on appuie.
  await page.keyboard.down('Space');
  await expect(canvas).toHaveClass(/plan-canvas-panning/u);
  await drag();
  await page.keyboard.up('Space');
  const afterSpace = (await wall.boundingBox())!;
  expect(
    Math.hypot(afterSpace.x - before.x, afterSpace.y - before.y),
  ).toBeGreaterThan(50);
  await expect(canvas).not.toHaveClass(/plan-canvas-panning/u);
});
