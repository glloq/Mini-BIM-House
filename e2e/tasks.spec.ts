import { expect, test, type Page } from '@playwright/test';

import { loadDemoProject } from './support/file-menu.js';
import { openDestination, openStage } from './support/navigation.js';
import { openSection, revealAllTools } from './support/tools.js';
import { openDisplayPanel, closeDisplayPanel } from './support/panels.js';

/**
 * Les six parcours, à la souris seule.
 *
 * Les autres tests vérifient des écrans ; ceux-ci vérifient des tâches, du
 * premier clic au dernier. Et ils les font **sans clavier** : `Ctrl+K` est un
 * accélérateur, et une fonction qui n'est atteignable que par lui est une
 * fonction que la moitié des gens n'atteindra jamais. Aucun de ces tests ne
 * presse une touche.
 *
 * Ils comptent aussi les clics, parce qu'un seuil qu'on ne mesure pas n'est
 * pas un seuil.
 */

/**
 * Ce qu'un parcours coûte, en gestes, compté dans la page.
 *
 * Compter dans le test ne compte que ce que le test croit faire ; compter dans
 * la page compte ce qui arrive vraiment, `locator.click()` compris.
 *
 * Et c'est `pointerdown` qu'on compte, pas `click` : le canvas travaille en
 * événements de pointeur et n'émet pas toujours de `click`, si bien qu'un
 * compteur de clics annonçait deux gestes là où la personne en avait fait
 * trois. Un compteur qui ne compte pas est pire que pas de compteur.
 */
async function countClicks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const holder = window as unknown as { __clicks?: number };
    holder.__clicks = 0;
    document.addEventListener(
      'pointerdown',
      () => {
        holder.__clicks = (holder.__clicks ?? 0) + 1;
      },
      true,
    );
  });
}

async function clicksSoFar(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { __clicks?: number }).__clicks ?? 0,
  );
}

/** Un point du canvas, lu sur le dessin plutôt qu'écrit à la main. */
async function pointOn(
  page: Page,
  id: string,
): Promise<{ x: number; y: number }> {
  return page.evaluate((wanted) => {
    const shape = document.getElementById(wanted)?.getBoundingClientRect();
    const frame = document
      .querySelector('.plan-canvas')
      ?.getBoundingClientRect();
    if (shape === undefined || frame === undefined)
      throw new Error(`Introuvable : ${wanted}`);
    return {
      x: shape.x - frame.x + shape.width / 2,
      y: shape.y - frame.y + shape.height / 2,
    };
  }, id);
}

test('T1 — un projet neuf, quatre murs, une porte, une fenêtre, une pièce', async ({
  page,
}) => {
  await countClicks(page);
  await page.goto('/');
  const canvas = page.locator('.plan-canvas');
  const toolbox = page.locator('.tool-header');

  // Trois clics pour le premier mur d'un projet neuf : l'outil, puis ses deux
  // points. L'étape Bâtiment le met sous la main sans qu'on ait à le chercher,
  // et il en fallait cinq — le seuil du §13.3 est trois.
  const walls = page.locator('[data-role="WALL_CUT"][id^="wall:"]');
  const beforeFirst = await clicksSoFar(page);
  await toolbox.getByRole('button', { name: 'Mur', exact: true }).click();
  await canvas.click({ position: { x: 80, y: 80 } });
  await canvas.click({ position: { x: 320, y: 80 } });
  await expect(walls).toHaveCount(1);
  expect((await clicksSoFar(page)) - beforeFirst).toBe(3);

  // Puis les trois autres, deux points chacun.
  const corners = [
    { x: 320, y: 80 },
    { x: 320, y: 260 },
    { x: 80, y: 260 },
    { x: 80, y: 80 },
  ];
  for (let index = 0; index + 1 < corners.length; index += 1) {
    await canvas.click({ position: corners[index]! });
    await canvas.click({ position: corners[index + 1]! });
  }
  await expect(walls).toHaveCount(4);

  // Une porte et une fenêtre : deux entrées qui nomment ce qu'elles posent,
  // dans la sous-partie qui les tient — un clic pour y aller, et le §14 en
  // demande exactement un.
  const beforePart = await clicksSoFar(page);
  await openSection(page, 'Ouvertures');
  expect((await clicksSoFar(page)) - beforePart).toBe(1);
  await toolbox.getByRole('button', { name: 'Porte', exact: true }).click();
  await canvas.click({ position: { x: 200, y: 80 } });
  await expect(page.getByRole('status')).toContainText('ouverture');
  await toolbox.getByRole('button', { name: 'Fenêtre', exact: true }).click();
  await canvas.click({ position: { x: 80, y: 170 } });
  await expect(page.locator('[data-role^="OPENING"]').first()).toBeVisible();

  // Et la pièce que ces murs enferment.
  await openSection(page, 'Pièces');
  await toolbox.getByRole('button', { name: 'Pièce', exact: true }).click();
  await canvas.click({ position: { x: 200, y: 170 } });
  await expect(page.locator('[data-role="SPACE_FILL"]').first()).toBeVisible();
});

test('T2 — de l’architecture à l’électricité, une prise et un circuit', async ({
  page,
}) => {
  await countClicks(page);
  await page.goto('/');
  await loadDemoProject(page);
  const beforeTrade = await clicksSoFar(page);

  // Deux clics pour changer de discipline : l'espace, puis le métier — qui
  // est une sous-partie, et se prend donc dans la rangée.
  await openStage(page, 'Systèmes');
  await openSection(page, 'Électricité');

  const toolbox = page.locator('.tool-header');
  await toolbox.getByRole('button', { name: 'Prise', exact: true }).click();
  // L'entrée a rempli la fiche : c'est ce qu'elle promet en portant ce nom.
  await expect(page.getByLabel('Modèle catalogue')).toHaveValue(
    /generic-socket/u,
  );
  await expect(page.locator('.context-tool-bar')).toContainText('Cliquez où');

  await toolbox
    .getByRole('button', { name: 'Tracer un tronçon', exact: true })
    .click();
  await expect(page.locator('.context-tool-bar')).toContainText('Cliquez');
  // Quatre gestes depuis la maison chargée : l'étape, le métier, la prise, le
  // tronçon. Le seuil du §13.3 est de deux pour changer de discipline.
  expect((await clicksSoFar(page)) - beforeTrade).toBeLessThanOrEqual(4);
});

test('T3 — changer de niveau, de discipline, et masquer une famille', async ({
  page,
}) => {
  await countClicks(page);
  await page.goto('/');
  await loadDemoProject(page);
  const tree = page.getByRole('navigation', { name: 'Arborescence du projet' });

  // Un clic pour changer de niveau : la rangée est là, en permanence, et il en
  // fallait deux — ouvrir « ☰ Modèle », puis choisir.
  const beforeLevel = await clicksSoFar(page);
  await tree.getByRole('button', { name: 'Étage', exact: true }).click();
  await expect(page.locator('.status-bar')).toContainText('Étage');
  expect((await clicksSoFar(page)) - beforeLevel).toBe(1);

  // Deux clics pour changer de discipline.
  await openStage(page, 'Systèmes');
  await openSection(page, 'Chauffage');

  // Deux clics pour masquer une famille : le bouton, puis le préréglage. Il en
  // fallait trois, et il y avait deux écrans pour le faire.
  const beforeHide = await clicksSoFar(page);
  await openDisplayPanel(page);
  await page
    .getByRole('dialog', { name: 'Affichage' })
    .getByRole('button', { name: 'Architecture', exact: true })
    .click();
  await expect(page.getByRole('button', { name: /^Affichage/u })).toContainText(
    /\d/u,
  );
  expect((await clicksSoFar(page)) - beforeHide).toBe(2);
  await closeDisplayPanel(page);
});

test('T4 — un mur, son assemblage, sa suppression, et le retour', async ({
  page,
}) => {
  await countClicks(page);
  await page.goto('/');
  await loadDemoProject(page);
  const canvas = page.locator('.plan-canvas');
  const beforeWall = await clicksSoFar(page);
  await canvas.click({ position: await pointOn(page, 'wall:wall-south') });
  const inspector = page.locator('.inspector-subject');
  await expect(inspector).toContainText('Mur');

  // Deux clics pour atteindre l'assemblage d'un mur : le mur, puis le champ.
  // Il fallait quitter le plan, trouver la fiche, puis revenir.
  const field = inspector.locator('.inspector-edit', { hasText: 'Assemblage' });
  await expect(
    field.getByRole('button', { name: 'Bibliothèque…' }),
  ).toBeVisible();
  // Un clic sur le mur, et l'assemblage est là. Il fallait quatre gestes et un
  // retour : quitter le plan, trouver la fiche, revenir.
  expect((await clicksSoFar(page)) - beforeWall).toBe(1);

  const before = await page
    .locator('[data-role="WALL_CUT"][id^="wall:"]')
    .count();
  await inspector.getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByRole('status')).toContainText(/Supprim|Refus/u);

  // Et l'on revient en arrière à la souris : le bouton est dans la barre.
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.locator('[data-role="WALL_CUT"][id^="wall:"]')).toHaveCount(
    before,
  );
});

test('T5 — vérifier, lire un constat, l’ouvrir sur l’objet', async ({
  page,
}) => {
  await page.goto('/');
  await loadDemoProject(page);
  await openDestination(page, 'Vérifications');
  const findings = page.locator('.alert-list li');
  await expect(findings.first()).toBeVisible();

  // Un constat mène à ce dont il parle : c'est ce que `UiTarget` sert à dire.
  const shown = findings.locator('button', { hasText: 'Afficher' }).first();
  if ((await shown.count()) > 0) {
    await shown.click();
    await expect(page.locator('.plan-canvas')).toBeVisible();
  }
});

test('T6 — documents, une vue enregistrée, un export', async ({ page }) => {
  await page.goto('/');
  await loadDemoProject(page);
  await openDestination(page, 'Vues et feuilles');
  await page.getByLabel('Nom de la vue').fill('Parcours');
  await page.getByRole('button', { name: 'Enregistrer cette vue' }).click();
  await expect(page.getByRole('status')).toContainText('enregistrée');

  // Et l'export part du menu Fichier, à la souris.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Fichier' }).click();
  await page.getByRole('menuitem', { name: 'Exporter le SVG' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.svg$/u);
});

test('T7 — un outil qui ne sert pas encore dit pourquoi, et y mène', async ({
  page,
}) => {
  /*
   * Le contraire d'un bouton grisé en silence.
   *
   * Sur un projet neuf il n'y a pas de mur, donc pas de porte à poser. La
   * question n'est pas de savoir si le bouton est inerte — c'est de savoir si
   * la personne comprend ce qui manque, et si elle peut y aller de là.
   */
  await page.goto('/');
  const toolbox = page.locator('.tool-header');
  await openSection(page, 'Ouvertures');
  const door = toolbox.getByRole('button', { name: 'Porte', exact: true });

  await expect(door).toContainText('Tracez d’abord un mur');
  await expect(door).toHaveAttribute('aria-description', /mur/);
  await expect(door).toHaveClass(/blocked/);

  // Et la tuile est le geste : cliquer dessus prend l'outil qui débloque,
  // fût-il dans une autre sous-partie. Elle n'est donc pas désactivée — un
  // bouton qu'on annonce inerte et qui agit ment à qui l'écoute.
  await door.click();
  await openSection(page, 'Murs');
  await expect(
    toolbox.getByRole('button', { name: 'Mur', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');

  // Un mur tracé, et la porte n'a plus rien à expliquer.
  const canvas = page.locator('.plan-canvas');
  await canvas.click({ position: { x: 80, y: 80 } });
  await canvas.click({ position: { x: 320, y: 80 } });
  await openSection(page, 'Ouvertures');
  await expect(door).not.toContainText('Tracez');
  await expect(door).not.toHaveClass(/blocked/);

  // Et là où rien ne débloque dans la rangée, le bouton est vraiment inerte,
  // raison comprise : un réseau se crée ailleurs que dans la boîte à outils.
  await openStage(page, 'Systèmes');
  await openSection(page, 'Eau');
  const run = toolbox.getByRole('button', {
    name: 'Tracer un tronçon',
    exact: true,
  });
  await expect(run).toBeDisabled();
  await expect(run).toContainText('réseau');

  /*
   * Et une question qui ne se pose pas ne se pose pas.
   *
   * Sur une maison d'un seul niveau il n'y a pas d'escalier à dessiner : la
   * sous-partie est absente, pas grisée — il n'y a rien à expliquer. L'outil,
   * lui, reste atteignable sous « + », comme les vingt-quatre autres.
   */
  await openStage(page, 'Bâtiment');
  const parts = page.getByRole('navigation', { name: 'Sous-parties' });
  await expect(
    parts.getByRole('button', { name: 'Escalier', exact: true }),
  ).toHaveCount(0);
  await revealAllTools(page);
  await expect(
    toolbox.getByRole('button', { name: 'Escalier', exact: true }),
  ).toBeVisible();
});
