import { expect, test, type Page } from '@playwright/test';

import { loadDemoProject } from './support/file-menu.js';
import { openInspector } from './support/panels.js';
import { chooseTool } from './support/tools.js';

/**
 * Les quatre façons de refermer une surface.
 *
 * Une dalle, une toiture, une trémie et une parcelle sont le même geste :
 * poser des sommets jusqu'à ce que le contour se referme. Il n'y avait qu'un
 * seul moyen d'y arriver — « Ctrl+Entrée », écrit dans une boîte flottante —
 * et l'aide générale annonçait Entrée. Quelqu'un qui dessine à la souris
 * n'avait aucun moyen de finir ce qu'il avait commencé.
 *
 * Ces tests figent les quatre gestes, et qu'aucun ne réclame le clavier.
 */

/**
 * Un contour, en fractions du canvas, pour ne pas dépendre de sa taille.
 *
 * Il commence bas : la seconde ligne du header flotte au-dessus du plan, et
 * cliquer sous elle est ce que ferait quelqu'un qui la voit.
 */
const CORNERS = [
  { x: 0.2, y: 0.34 },
  { x: 0.7, y: 0.34 },
  { x: 0.7, y: 0.76 },
  { x: 0.2, y: 0.76 },
] as const;

type Position = { readonly x: number; readonly y: number };

async function placeCorners(
  page: Page,
  corners: readonly Position[] = CORNERS,
): Promise<Position[]> {
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const placed: Position[] = [];
  for (const corner of corners) {
    const at = { x: box.width * corner.x, y: box.height * corner.y };
    await canvas.click({ position: at });
    placed.push(at);
  }
  return placed;
}

/**
 * La maison de démonstration, chargée **et dessinée**.
 *
 * Compter les dalles avant que le plan ait fini de se dessiner compte zéro, et
 * un test qui compare à zéro passe pour de mauvaises raisons.
 */
async function readyDemo(page: Page): Promise<void> {
  await page.goto('/');
  await loadDemoProject(page);
  await expect(page.locator('[id^="wall:"]').first()).toBeVisible();
  await expect(page.locator('[id^="slab:"]').first()).toBeAttached();
}

/** Le bouton d'achèvement, où qu'il soit offert — la barre ou les champs. */
function closeButton(page: Page) {
  return page.getByRole('button', { name: 'Fermer la surface' }).first();
}

test('nomme le geste par ce qu’il fait, et le propose à la souris', async ({
  page,
}) => {
  await readyDemo(page);
  await chooseTool(page, 'Dalle libre');
  await placeCorners(page, CORNERS.slice(0, 3));

  // Le bouton dit « fermer », pas « terminer » : ce qu'on crée est une
  // surface, et l'écran ne doit pas laisser douter de ce qui va apparaître.
  await expect(closeButton(page)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Annuler dernier sommet' }).first(),
  ).toBeVisible();

  // Et ce qu'elle mesure est écrit pendant qu'on la trace, pas après.
  await expect(page.locator('.draft-measures')).toContainText('m²');
});

test('ferme une dalle par son bouton, sans toucher au clavier', async ({
  page,
}) => {
  await readyDemo(page);
  const slabs = page.locator('[id^="slab:"]');
  const before = await slabs.count();
  await chooseTool(page, 'Dalle libre');
  await placeCorners(page);
  await closeButton(page).click();
  await expect(slabs).toHaveCount(before + 1);
});

test('ferme une toiture en recliquant son premier sommet', async ({ page }) => {
  await readyDemo(page);
  await chooseTool(page, 'Pan libre');
  const placed = await placeCorners(page);
  // Le geste que tout le monde essaie : revenir au point de départ. Il posait
  // un sommet de plus au même endroit.
  await page.locator('.plan-canvas').click({ position: placed[0]! });
  await expect(page.getByRole('status')).toContainText(/toiture/iu);
  // Et le tracé est bien fini : l'outil repart de sa première étape, qui dit
  // désormais de quel objet elle parle plutôt que le rang du clic.
  await expect(page.locator('.context-instruction')).toContainText(
    'premier coin de la toiture',
  );
});

test('ferme une parcelle par Entrée, et la retire sommet par sommet', async ({
  page,
}) => {
  await readyDemo(page);
  await chooseTool(page, 'Parcelle');
  await placeCorners(page);

  // Un sommet de trop se retire seul : Échap coûtait les trois autres, donc
  // on recommençait plutôt que de corriger.
  await page
    .getByRole('button', { name: 'Annuler dernier sommet' })
    .first()
    .click();
  await expect(page.locator('.context-instruction')).toContainText('3 posé(s)');

  await placeCorners(page, [CORNERS[3]]);
  await page.keyboard.press('Enter');
  await expect(page.locator('[id="site:parcel"]')).toHaveCount(1);
});

test('perce une trémie dans la dalle qu’on vient de fermer', async ({
  page,
}) => {
  await readyDemo(page);
  await chooseTool(page, 'Dalle libre');
  await placeCorners(page);
  await closeButton(page).click();

  await chooseTool(page, 'Trémie');
  await placeCorners(page, [
    { x: 0.34, y: 0.44 },
    { x: 0.5, y: 0.44 },
    { x: 0.5, y: 0.62 },
    { x: 0.34, y: 0.62 },
  ]);
  await closeButton(page).click();
  await expect(page.getByRole('status')).toContainText(/trémie/iu);
  console.log(
    'SOMMETS',
    (await page.locator('.inspector-subject').textContent())?.slice(0, 120),
  );
});

test('l’aide et les champs disent la même chose de la touche Entrée', async ({
  page,
}) => {
  await readyDemo(page);
  await chooseTool(page, 'Parcelle');
  await placeCorners(page, CORNERS.slice(0, 2));

  // Une surface se ferme, un chemin se termine : le mot change, jamais la
  // touche, et « Ctrl+Entrée » n'est réclamé nulle part.
  const instruction = page.locator('.context-instruction');
  await expect(instruction).toContainText('Fermer la surface : Entrée');
  await expect(instruction).not.toContainText('Ctrl');
});

test('cote une parcelle à 30 sur 25, lit 750 m², et défait', async ({
  page,
}) => {
  /*
   * Le parcours que l'audit demande, en entier.
   *
   * On traçait au jugé, on créait, on lisait la surface, on annulait, on
   * recommençait. Une surface se cote : on donne ses mesures et elle les prend.
   */
  await readyDemo(page);
  await openInspector(page);
  await chooseTool(page, 'Parcelle');
  await placeCorners(page);
  await closeButton(page).click();
  await expect(page.locator('[id="site:parcel"]')).toHaveCount(1);

  await chooseTool(page, 'Sélection');
  const canvas = page.locator('.plan-canvas');
  const frame = (await canvas.boundingBox())!;
  const parcel = (await page.locator('[id="site:parcel"]').boundingBox())!;
  // Un bord, pas le centre : la maison est posée au milieu de la parcelle, et
  // c'est elle qu'on prendrait en visant le milieu.
  await canvas.click({
    position: {
      x: parcel.x - frame.x + 2,
      y: parcel.y - frame.y + parcel.height / 2,
    },
  });
  await expect(page.locator('.inspector-subject')).toContainText('Parcelle');

  // Les poignées existent : une parcelle se corrige sommet par sommet, elle
  // ne se retrace pas.
  await expect(page.locator('.grip-polygon-vertex')).toHaveCount(4);

  const width = page.getByLabel(/^Largeur/u);
  const depth = page.getByLabel(/^Profondeur/u);
  await width.fill('30000');
  await width.press('Enter');
  await depth.fill('25000');
  await depth.press('Enter');

  // 30 × 25 : la surface est recalculée tout de suite, sans rien rouvrir.
  await expect(page.locator('.inspector-subject')).toContainText('750');

  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.locator('.inspector-subject')).not.toContainText('750');
});

test('corrige une trémie, qui est un objet comme un autre', async ({
  page,
}) => {
  await readyDemo(page);
  await openInspector(page);
  await chooseTool(page, 'Dalle libre');
  await placeCorners(page);
  await closeButton(page).click();

  await chooseTool(page, 'Trémie');
  await placeCorners(page, [
    { x: 0.34, y: 0.44 },
    { x: 0.5, y: 0.44 },
    { x: 0.5, y: 0.62 },
    { x: 0.34, y: 0.62 },
  ]);
  await closeButton(page).click();
  await expect(page.getByRole('status')).toContainText(/trémie/iu);

  /*
   * Elle est déjà désignée : ce qu'on vient de fermer est ce qu'on veut
   * regarder. Elle vivait dans un tableau, sans nom — rien ne pouvait la
   * corriger, et on annulait, ou on refaisait la dalle.
   */
  await expect(page.locator('[id*="#hole:0"]').first()).toBeAttached();
  await expect(page.locator('.inspector-subject')).toContainText('Trémie');
  await expect(page.getByLabel(/^Largeur/u)).toBeVisible();
  // Et ses poignées sont là : quatre sommets, quatre milieux de côté.
  await expect(page.locator('.grip-polygon-vertex')).toHaveCount(4);
  await expect(page.locator('.grip-polygon-edge')).toHaveCount(4);
});
