import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

import { fileAction } from './support/file-menu.js';

import { openDestination, openStage } from './support/navigation.js';
import {
  chooseOverlay,
  choosePreset,
  closeDisplayPanel,
  hidePlacedComponents,
  openDisplayPanel,
  openInspector,
  openLayerEditor,
  openModelTree,
} from './support/panels.js';
import { chooseTool, openSection, toolButton } from './support/tools.js';

/**
 * Console errors are a failure, not noise: a blank page caused by an unhandled
 * module error is exactly what these tests exist to catch.
 */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    // A missing favicon is a server concern rather than an application defect.
    if (message.text().includes('favicon')) return;
    errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function loadDemo(page: Page): Promise<void> {
  await page.goto('/');
  await fileAction(page, 'Maison de démonstration');
  await expect(page.getByRole('status')).toContainText('démonstration');
}

test('loads without a console error and shows an empty plan', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'House Technical Designer',
  );
  await expect(page.getByRole('status')).toContainText('Nouveau projet');
  expect(errors).toEqual([]);
});

test('a new project ships a library a wall can be drawn with', async ({
  page,
}) => {
  await page.goto('/');
  await openDestination(page, 'Matériaux');
  await expect(page.locator('.library-table tbody tr').first()).toBeVisible();
  const materials = await page.locator('.library-table tbody tr').count();
  expect(materials).toBeGreaterThan(5);

  await openDestination(page, 'Assemblages');
  // A basket, not a shelf: one build-up per kind of surface a house shell is
  // made of. It used to be every build-up the catalogue ships, which is how a
  // project with nothing drawn in it came to weigh ninety-two kilobytes.
  await expect(page.locator('.assembly-card').first()).toBeVisible();
  const buildUps = await page.locator('.assembly-card').count();
  expect(buildUps).toBeGreaterThan(3);
  expect(buildUps).toBeLessThan(15);
});

test('takes a build-up out of the catalogue, with what it is made of', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto('/');

  await openDestination(page, 'Matériaux');
  await expect(page.locator('.library-table tbody tr').first()).toBeVisible();
  const before = await page.locator('.library-table tbody tr').count();

  await openDestination(page, 'Assemblages');
  await expect(page.locator('.assembly-card').first()).toBeVisible();
  const buildUps = await page.locator('.assembly-card').count();

  // The picker asks the question a user has — which one — instead of offering
  // « import the whole generic catalogue », which is how a project with
  // nothing drawn in it came to carry a hundred and twenty-eight fiches.
  await page
    .getByRole('button', { name: 'Ajouter depuis le catalogue' })
    .click();
  const picker = page.getByRole('group', {
    name: 'Ajouter depuis le catalogue',
  });
  await picker.getByRole('searchbox').fill('bardage');
  const choice = picker.getByRole('button').filter({ hasText: 'Bardage' });
  await expect(choice.first()).toBeVisible();
  await choice.first().click();

  await expect(page.locator('.assembly-card')).toHaveCount(buildUps + 1);

  // And the materials came with it: a layer pointing at a material the project
  // does not hold is a wall that draws, costs nothing and insulates nothing.
  await openDestination(page, 'Matériaux');
  const after = await page.locator('.library-table tbody tr').count();
  expect(after).toBeGreaterThan(before);
  expect(errors).toEqual([]);
});

test('gives the menuiseries a home, and a way back to the catalogue', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto('/');
  await openDestination(page, 'Menuiseries');

  // Three came with the project. The other thirty-one were unreachable once a
  // blank project stopped being handed the whole shelf — a basket that takes
  // options away has to give a way to get them back.
  const rows = page.locator('.library-table tbody tr');
  await expect(rows.first()).toBeVisible();
  const before = await rows.count();

  await page
    .getByRole('button', { name: 'Ajouter depuis le catalogue' })
    .click();
  const picker = page.getByRole('group', {
    name: 'Ajouter depuis le catalogue',
  });
  await picker.getByRole('searchbox').fill('coulissante');
  const choice = picker.getByRole('button').filter({ hasText: 'oulissante' });
  await expect(choice.first()).toBeVisible();
  await choice.first().click();

  await expect(rows).toHaveCount(before + 1);
  // And what the choice is made on is shown: a Uw, a solar factor, an
  // acoustic figure — the reason one menuiserie is picked over another.
  await expect(page.locator('.library-table tbody')).toContainText('Uw');
  expect(errors).toEqual([]);
});

test('draws the reference house with real walls, openings and rooms', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const scene = page.locator('.plan-canvas-scene svg');
  await expect(scene).toBeVisible();
  await expect(page.locator('[data-role="WALL_CUT"][id^="wall:"]')).toHaveCount(
    6,
  );
  // Trois ouvertures, et ce qu'il faut pour les lire : la porte donne sa
  // réservation, son vantail et son arc ; chaque fenêtre donne sa réservation,
  // son dormant et son vitrage. Une fenêtre était un trait tiré en travers de
  // la maçonnerie, sans le dormant qui la rend posée dans le trou.
  await expect(
    page.locator('[data-layer="architecture.openings"] > *'),
  ).toHaveCount(9);
  await expect(page.locator('[data-role="OPENING_REVEAL"]')).toHaveCount(3);
  await expect(
    page.locator('[data-layer="architecture.spaces"] > *'),
  ).toHaveCount(4);
  expect(errors).toEqual([]);
});

test('adds a wall, then undoes and redoes it', async ({ page }) => {
  await loadDemo(page);
  const walls = page.locator('[data-role="WALL_CUT"][id^="wall:"]');
  await expect(walls).toHaveCount(6);

  await chooseTool(page, 'Mur');
  // Clicking through the locator scrolls the canvas into view first, so the
  // points land on the drawing rather than outside the window.
  const canvas = page.locator('.plan-canvas');
  await canvas.click({ position: { x: 120, y: 380 } });
  await canvas.click({ position: { x: 420, y: 380 } });
  await expect(page.getByRole('status')).toContainText('Ajouter un mur');
  await expect(walls).toHaveCount(7);

  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(walls).toHaveCount(6);
  await page.getByRole('button', { name: 'Rétablir', exact: true }).click();
  await expect(walls).toHaveCount(7);
});

test('selects an object and describes it in the inspector', async ({
  page,
}) => {
  await loadDemo(page);
  const canvas = page.locator('.plan-canvas');
  const box = (await canvas.boundingBox())!;
  // The centre of the plan falls inside a room.
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
  const inspector = page.locator('.inspector-subject');
  await expect(inspector).toBeVisible();
  await expect(inspector.getByRole('heading', { level: 3 })).not.toBeEmpty();
});

test('runs every calculation module from the dashboard', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await openDestination(page, 'Calculs');
  await expect(page.locator('.dashboard-card').first()).toBeVisible();
  await expect(page.locator('.module-header')).toHaveCount(17);
  // No module may end in a hard failure on the reference project.
  await expect(page.locator('.badge.status-error')).toHaveCount(0);
  await expect(page.locator('.badge.status-failed')).toHaveCount(0);
  await expect(
    page.locator('.dashboard-card', { hasText: 'Puissance de chauffage' }),
  ).toContainText('kW');
  expect(errors).toEqual([]);
});

test('shows a thermal overlay with a legend', async ({ page }) => {
  await loadDemo(page);
  // L'analyse vit dans Études : une superposition colorée est une étude qu'on
  // lit sur le dessin plutôt que dans un tableau.
  await chooseOverlay(page, 'thermal-u');
  await expect(page.locator('.overlay-legend')).toBeVisible();
  const coloured = page.locator('[data-layer="analysis.overlay"] > *');
  // The whole envelope is coloured now, not the opaque walls alone: the
  // windows, the roof and the floor were computed as nothing at all.
  await expect(coloured).toHaveCount(8);
  for (const id of ['wall-south', 'opening-living', 'slab-ground'])
    await expect(
      page.locator(`[data-layer="analysis.overlay"] [data-source-id="${id}"]`),
    ).toHaveCount(1);
});

test('lists the bill of materials and offers a CSV export', async ({
  page,
}) => {
  await loadDemo(page);
  await openDestination(page, 'Quantités');
  await expect(page.locator('.library-table tbody tr').first()).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter en CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toContain('nomenclature');
});

test('compares a scenario against the project', async ({ page }) => {
  await loadDemo(page);
  await openDestination(page, 'Scénarios');
  await expect(page.locator('.delta').first()).toBeVisible({ timeout: 20_000 });
  const deltas = await page.locator('.delta').allTextContents();
  expect(deltas.some((value) => value.includes('-'))).toBe(true);
});

test('saves the project and reloads it unchanged', async ({ page }) => {
  await loadDemo(page);
  const download = page.waitForEvent('download');
  await fileAction(page, 'Sauvegarder');
  const file = await download;
  const path = await file.path();
  expect(path).not.toBeNull();

  await page.reload();
  await expect(page.getByRole('status')).toContainText('Nouveau projet');
  await page.setInputFiles('input[type="file"]', path);
  await expect(page.getByRole('status')).toContainText('chargé et validé');
  await expect(page.locator('[data-role="WALL_CUT"][id^="wall:"]')).toHaveCount(
    6,
  );
});

test('carries the climate with the project in one file', async ({ page }) => {
  await loadDemo(page);
  await openDestination(page, 'Projet');
  // The demonstration project comes with its datasets loaded in the session.
  await expect(page.locator('.library-panel')).not.toContainText(
    'Aucun jeu de données climatiques',
  );

  const download = page.waitForEvent('download');
  await fileAction(page, 'Sauvegarder');
  const saved = await (await download).path();
  await expect(page.getByRole('status')).toContainText('.houseproj');
  await expect(page.getByRole('status')).toContainText('climatiques');

  // Reopened from nothing — as another machine would — the project still has
  // the weather it was calculated on.
  await page.reload();
  const prompt = page.getByRole('alertdialog');
  if ((await prompt.count()) > 0)
    await prompt.getByRole('button', { name: 'Ignorer et supprimer' }).click();
  await expect(page.getByRole('status')).toContainText('Nouveau projet');
  await page.setInputFiles('input[type="file"]', saved);
  await expect(page.getByRole('status')).toContainText('climatiques');

  await openDestination(page, 'Projet');
  await expect(page.locator('.library-panel')).not.toContainText(
    'Aucun jeu de données climatiques',
  );
  await openDestination(page, 'Calculs');
  await expect(page.locator('.dashboard-card').first()).toBeVisible();
});

test('switches level and discipline view without losing the model', async ({
  page,
}) => {
  await loadDemo(page);
  await choosePreset(page, 'Plomberie');
  await expect(
    page.locator('[data-layer="water.pipes"]').first(),
  ).toBeVisible();
  await choosePreset(page, 'Architecture');
  await expect(page.locator('[data-role="WALL_CUT"][id^="wall:"]')).toHaveCount(
    6,
  );
});

test('keyboard shortcuts drive the tools', async ({ page }) => {
  await loadDemo(page);
  await page.locator('.plan-canvas').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('w');
  await expect(toolButton(page, 'Mur')).toHaveAttribute('aria-pressed', 'true');
  // Et le sommaire de la colonne le dit aussi : c'est le même registre, montré
  // aux deux endroits où l'on peut le prendre, jamais deux registres.
  await expect(
    page
      .getByRole('navigation', { name: 'Sous-parties' })
      .getByRole('button', { name: 'Mur', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  // La rangée au-dessus du plan ne propose plus ce que la sous-partie pose,
  // mais elle montre toujours l'outil en cours : un plan qui dessine sans
  // dire avec quoi est un plan qui surprend.
  await expect(
    page
      .locator('.tool-header')
      .getByRole('button', { name: 'Mur', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(toolButton(page, 'Sélection')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('autosaves an edit and offers to restore it after a reload', async ({
  page,
}) => {
  await loadDemo(page);
  await expect(page.locator('.save-state')).toHaveText('Enregistré');

  await chooseTool(page, 'Mur');
  const canvas = page.locator('.plan-canvas');
  await canvas.click({ position: { x: 120, y: 380 } });
  await canvas.click({ position: { x: 420, y: 380 } });
  await expect(page.locator('.save-state')).toHaveText('Modifié');
  await expect(page.locator('.save-state')).toContainText(
    'Sauvegardé localement',
    { timeout: 10_000 },
  );

  await page.reload();
  const prompt = page.getByRole('alertdialog');
  await expect(prompt).toContainText('sauvegarde locale');
  await prompt.getByRole('button', { name: 'Restaurer' }).click();
  await expect(page.locator('[data-role="WALL_CUT"][id^="wall:"]')).toHaveCount(
    7,
  );
});

test('restores the climate along with the autosaved project', async ({
  page,
}) => {
  await loadDemo(page);
  await chooseTool(page, 'Mur');
  const canvas = page.locator('.plan-canvas');
  await canvas.click({ position: { x: 120, y: 380 } });
  await canvas.click({ position: { x: 420, y: 380 } });
  await expect(page.locator('.save-state')).toContainText(
    'Sauvegardé localement',
    { timeout: 10_000 },
  );

  await page.reload();
  const prompt = page.getByRole('alertdialog');
  await expect(prompt).toContainText('sauvegarde locale');
  await prompt.getByRole('button', { name: 'Restaurer' }).click();
  // The weather the session was calculating with comes back with the project;
  // without it the modules would silently report missing inputs again.
  await expect(page.getByRole('status')).toContainText('climatiques');
  await openDestination(page, 'Projet');
  await expect(page.locator('.library-panel')).not.toContainText(
    'Aucun jeu de données climatiques',
  );
});

test('discards the local snapshot when the user declines it', async ({
  page,
}) => {
  await loadDemo(page);
  await chooseTool(page, 'Mur');
  const canvas = page.locator('.plan-canvas');
  await canvas.click({ position: { x: 120, y: 380 } });
  await canvas.click({ position: { x: 420, y: 380 } });
  await expect(page.locator('.save-state')).toContainText(
    'Sauvegardé localement',
    { timeout: 10_000 },
  );

  await page.reload();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Ignorer et supprimer' })
    .click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('creates a technical network, places a node on the plan and routes it', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await openDestination(page, 'Réseaux');
  await expect(page.locator('.library-table tbody tr').first()).toBeVisible();

  await page.getByLabel('Discipline', { exact: true }).selectOption('HEATING');
  // The system is chosen from the kinds the discipline offers, not spelled.
  await page
    .getByLabel('Système', { exact: true })
    .selectOption('RADIATOR_LOOP');
  await page.getByRole('button', { name: 'Créer le réseau' }).click();
  const networkRow = page.locator('.library-table tbody tr', {
    hasText: 'RADIATOR_LOOP',
  });
  await expect(networkRow).toHaveCount(1);
  await networkRow.getByRole('button', { name: 'Chauffage' }).click();

  // The generator alone is open, waiting for something to feed.
  await expect(networkRow.locator('.badge.missing')).toContainText(
    '1 port(s) libre(s)',
  );

  await openDestination(page, 'Plan');
  await chooseTool(page, 'Réseau');
  await page
    .getByLabel('Réseau', { exact: true })
    .selectOption('network-heating-radiator-loop');
  await page.getByLabel('Type de nœud').selectOption('EMITTER');
  await page.locator('.plan-canvas').click({ position: { x: 260, y: 240 } });
  await expect(page.getByRole('status')).toContainText('Ajouter un nœud');

  await openDestination(page, 'Réseaux');
  await page.getByLabel('Départ').selectOption({ index: 1 });
  await page.getByLabel('Arrivée').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Relier' }).click();

  const segments = page.locator('.library-table tbody tr', { hasText: 'PIPE' });
  await expect(segments).toHaveCount(1);
  await expect(segments).toContainText(' m');
  expect(errors).toEqual([]);
});

test('sizes a duct and a terminal from the network inspector', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await openDestination(page, 'Réseaux');
  await page
    .locator('.library-table tbody tr', { hasText: 'Ventilation' })
    .getByRole('button', { name: 'Ventilation' })
    .click();

  // A duct states its section, its bore and its role; nothing is assumed.
  const duct = page
    .locator('.library-table tbody tr', { hasText: 'DUCT' })
    .first();
  await duct.getByRole('button', { name: 'Propriétés' }).click();

  // Rectangular is a real choice: it asks for two sides, and the diameter that
  // no longer describes anything goes away with it.
  const section = page.getByLabel('Section', { exact: true });
  await section.selectOption('RECTANGULAR');
  await expect(page.getByRole('status')).toContainText(
    'Modifier un tronçon du réseau',
  );
  await expect(page.getByLabel('Largeur')).toBeVisible();
  await expect(page.getByLabel('Hauteur')).toBeVisible();
  await expect(page.getByLabel('Diamètre intérieur')).toHaveValue('');

  await section.selectOption('ROUND');
  const diameter = page.getByLabel('Diamètre intérieur');
  await expect(diameter).toBeVisible();
  await diameter.fill('0.16');
  await diameter.press('Enter');
  await expect(page.getByRole('status')).toContainText(
    'Modifier un tronçon du réseau',
  );

  // An out-of-range value is refused rather than stored.
  const terminal = page
    .locator('.library-table tbody tr', { hasText: 'Bouche' })
    .first();
  await terminal.getByRole('button', { name: 'Propriétés' }).click();
  const flow = page.getByLabel('Débit visé');
  await expect(flow).toBeVisible();
  await flow.fill('-10');
  await flow.press('Enter');
  await expect(page.getByRole('status')).toContainText('Refusé');
  await flow.fill('52');
  await flow.press('Enter');
  await expect(page.getByRole('status')).toContainText(
    'Modifier un nœud du réseau',
  );

  // What was typed is what the file carries.
  const download = page.waitForEvent('download');
  await fileAction(page, 'Exporter le JSON');
  const saved = JSON.parse(
    await readFile(await (await download).path(), 'utf8'),
  ) as {
    project: {
      systems: readonly {
        readonly discipline: string;
        readonly nodes: readonly {
          readonly properties?: Record<string, unknown>;
        }[];
        readonly edges: readonly {
          readonly properties?: Record<string, unknown>;
        }[];
      }[];
    };
  };
  const ventilation = saved.project.systems.find(
    ({ discipline }) => discipline === 'VENTILATION',
  );
  expect(
    ventilation?.edges.some((edge) => edge.properties?.diameterM === 0.16),
  ).toBe(true);
  expect(
    ventilation?.nodes.some((node) => node.properties?.targetFlowM3h === 52),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('reshapes a wall after drawing it, instead of redrawing it', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await hidePlacedComponents(page);
  const canvas = page.locator('.plan-canvas');
  const canvasBox = (await canvas.boundingBox())!;
  // Scinder, décaler, joindre et ajuster sont des outils de productivité CAO :
  // ils apparaissent au niveau Expert de l'interface.
  // The east wall carries no opening and no partition crosses it.
  const east = (await page.locator('[id="wall:wall-east"]').boundingBox())!;
  await canvas.click({
    position: {
      x: east.x - canvasBox.x + east.width / 2,
      y: east.y - canvasBox.y + east.height * 0.25,
    },
  });

  // A selected wall offers its ends and a handle to move it whole.
  const grips = page.locator('.grip');
  await expect(grips).toHaveCount(3);

  // Length and angle are editable as numbers, and the geometry follows.
  const length = page.getByLabel('Longueur (mm)');
  await expect(length).toBeVisible();
  await length.fill('7000');
  await length.press('Enter');
  await expect(page.getByRole('status')).toContainText(
    'Modifier la géométrie du mur',
  );

  // Dragging the end handle moves that end and nothing else.
  const box = (await grips.nth(1).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + 40, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('status')).toContainText(
    'Déplacer une extrémité de mur',
  );

  // The wall can be cut in two, where the user points rather than at its
  // middle, and the pieces are two walls.
  const wallsBefore = await page
    .locator('[data-role="WALL_CUT"][id^="wall:"]')
    .count();
  await chooseTool(page, 'Scinder');
  await canvas.scrollIntoViewIfNeeded();
  const frame = (await canvas.boundingBox())!;
  const shape = (await page.locator('[id="wall:wall-south"]').boundingBox())!;
  // Aimed a third of the way along the wall, not at its middle: the point that
  // is clicked is the point where it is cut.
  await canvas.click({
    position: {
      x: shape.x - frame.x + shape.width * 0.3,
      y: shape.y - frame.y + shape.height / 2,
    },
  });
  await expect(page.getByRole('status')).toContainText('Scinder un mur');
  await expect(page.locator('[data-role="WALL_CUT"][id^="wall:"]')).toHaveCount(
    wallsBefore + 1,
  );

  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.locator('[data-role="WALL_CUT"][id^="wall:"]')).toHaveCount(
    wallsBefore,
  );
  expect(errors).toEqual([]);
});

test('reshapes the footprint of a slab corner by corner', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await openDestination(page, 'Niveaux et pièces');
  const slab = page.locator('.catalog-list li', { hasText: 'slab' }).first();
  await slab.getByRole('button', { name: 'Modifier le contour' }).click();

  const vertices = page.locator('.grip-polygon-vertex');
  const edges = page.locator('.grip-polygon-edge');
  const corners = await vertices.count();
  expect(corners).toBeGreaterThanOrEqual(3);
  await expect(edges).toHaveCount(corners);

  // Clicking a side handle inserts a corner there.
  await edges.first().click();
  await expect(page.getByRole('status')).toContainText('Modifier une dalle');
  await expect(vertices).toHaveCount(corners + 1);

  // Alt-clicking a corner takes it back out.
  await vertices.nth(1).click({ modifiers: ['Alt'] });
  await expect(vertices).toHaveCount(corners);
  expect(errors).toEqual([]);
});

test('measures between two wall corners and keeps the cote in the project', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const dimensions = page.locator('[data-layer="annotation.dimensions"] > *');
  await expect(dimensions).toHaveCount(0);

  await chooseTool(page, 'Cotation');
  const canvas = page.locator('.plan-canvas');
  const box = (await canvas.boundingBox())!;
  // The south wall runs the whole width of the house; its two ends are the
  // corners the dimension attaches to.
  const wall = (await page.locator('[id="wall:wall-south"]').boundingBox())!;
  const at = (x: number, y: number) => ({ x: x - box.x, y: y - box.y });
  const middle = wall.y + wall.height / 2;
  await canvas.click({ position: at(wall.x + 4, middle) });
  await canvas.click({ position: at(wall.x + wall.width - 4, middle) });
  await canvas.click({ position: at(wall.x + wall.width / 2, middle + 40) });
  await expect(page.getByRole('status')).toContainText('Ajouter une cote');
  // Line, two witness lines and the value.
  await expect(dimensions).toHaveCount(4);

  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(dimensions).toHaveCount(0);
  await page.getByRole('button', { name: 'Rétablir', exact: true }).click();
  await expect(dimensions).toHaveCount(4);

  // A dimension is a project fact: it survives a save and a reload.
  const download = page.waitForEvent('download');
  await fileAction(page, 'Sauvegarder');
  const file = await download;
  await page.reload();
  await page.setInputFiles('input[type="file"]', await file.path());
  await expect(page.getByRole('status')).toContainText('chargé et validé');
  await expect(dimensions).toHaveCount(4);
  expect(errors).toEqual([]);
});

test('exports the plan it draws, not a simplified redrawing of it', async ({
  page,
}) => {
  await loadDemo(page);
  const exportSvg = async (): Promise<string> => {
    const download = page.waitForEvent('download');
    await fileAction(page, 'Exporter le SVG');
    const file = await download;
    expect(file.suggestedFilename()).toContain('rez-de-chaussee');
    return readFile(await file.path(), 'utf8');
  };

  const architecture = await exportSvg();
  // The cut openings and the rooms are all in the file, and the sheet names
  // its scale.
  expect(architecture).toContain('architecture.openings');
  expect(architecture).toContain('architecture.spaces');
  expect(architecture).toContain('1:50');
  // Le plan d'architecte montre un mur, pas sa composition : trois bandes de
  // couleur dans chaque mur enterrent ce que ce dessin existe pour montrer.
  expect(architecture).not.toContain('architecture.wall-layers');
  // An exported drawing carries no interaction state.
  expect(architecture).not.toContain('data-state');
  // The architecture view does not draw the plumbing, and neither does its
  // export: the sheet is what the user is looking at.
  expect(architecture).not.toContain('water.pipes');

  // Un modèle, deux dessins, un préréglage : la composition du mur est le
  // sujet de la vue « Matériaux ».
  await choosePreset(page, 'Matériaux');
  const materials = await exportSvg();
  expect(materials).toContain('architecture.wall-layers');

  await choosePreset(page, 'Plomberie');
  const plumbing = await exportSvg();
  expect(plumbing).toContain('water.pipes');
});

test('creates a partition as a partition, not as an exterior wall', async ({
  page,
}) => {
  await loadDemo(page);
  // La maison de référence est équipée : la pompe à chaleur se dessine
  // par-dessus la cloison qu'on vient de tracer, et c'est elle que le clic
  // prendrait.
  await hidePlacedComponents(page);
  await chooseTool(page, 'Mur');
  // Choosing a partition assembly proposes the matching role rather than
  // leaving every drawn wall in the thermal envelope.
  await page.getByLabel('Assemblage').selectOption('generic-partition-stud');
  await expect(page.getByLabel('Rôle')).toHaveValue('PARTITION');

  const canvas = page.locator('.plan-canvas');
  const walls = page.locator('[data-role="WALL_CUT"][id^="wall:"]');
  const wallIds = async (): Promise<readonly string[]> =>
    walls.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('id') ?? ''),
    );
  const before = await wallIds();
  /*
   * Où tracer se lit sur le dessin, pas sur deux coordonnées écrites à la
   * main.
   *
   * Elles étaient (120, 380) et (420, 380) : justes tant que le canvas avait
   * la taille qu'il avait ce jour-là. Chaque pixel de chrome rendu au dessin
   * les déplaçait sur une fenêtre, puis sur une pompe à chaleur. La cloison se
   * trace sous la maison, où il n'y a rien.
   */
  const frame = (await canvas.boundingBox())!;
  const houseBottom = await walls.evaluateAll((nodes) =>
    Math.max(...nodes.map((node) => node.getBoundingClientRect().bottom)),
  );
  const below = Math.min(houseBottom - frame.y + 40, frame.height - 20);
  /*
   * Et à l'écart du coin bas-gauche, où le bouton « Image de fond » se pose.
   *
   * Un réglage posé sur le dessin prend de la place sur le dessin : c'est le
   * prix de le régler en regardant ce qu'il règle. On trace donc là où il n'y
   * a rien, comme on le ferait.
   */
  await canvas.click({ position: { x: 220, y: below } });
  await canvas.click({ position: { x: 420, y: below } });
  await expect(page.getByRole('status')).toContainText('Ajouter un mur');

  expect((await wallIds()).length).toBe(before.length + 1);

  /*
   * On reclique là où on a tracé, et non sur le mur tel qu'il se dessine.
   *
   * Le dessin s'ajuste à ce qu'il contient : ajouter un mur sous la maison
   * élargit le cadre, et tout le SVG se remet à l'échelle. Ce qui interprète
   * un clic est la caméra, qui n'a pas bougé : le point où l'on a posé le mur
   * est donc encore le point où il est.
   *
   * Sous la maison il y a la parcelle, qui couvre tout le terrain ; demander
   * les murs est ce que le filtre de sélection est fait pour.
   */
  await chooseTool(page, 'Sélection');
  await page.getByLabel('Filtrer sur').selectOption('WALL');
  await canvas.click({ position: { x: 320, y: below } });
  await expect(page.locator('.inspector-subject')).toContainText('PARTITION');
});

test('deletes a multiple selection as one undoable action', async ({
  page,
}) => {
  await loadDemo(page);
  const walls = page.locator('[data-role="WALL_CUT"][id^="wall:"]');
  await expect(walls).toHaveCount(6);

  const canvas = page.locator('.plan-canvas');
  const box = (await canvas.boundingBox())!;
  const south = (await page.locator('[id="wall:wall-south"]').boundingBox())!;
  const west = (await page.locator('[id="wall:wall-west"]').boundingBox())!;
  await canvas.click({
    position: {
      x: south.x - box.x + south.width / 2,
      y: south.y - box.y + south.height / 2,
    },
  });
  await canvas.click({
    position: {
      x: west.x - box.x + west.width / 2,
      y: west.y - box.y + west.height / 2,
    },
    modifiers: ['ControlOrMeta'],
  });
  await page.keyboard.press('Delete');
  await expect(page.getByRole('status')).toContainText('Supprimer 2 objets');
  await expect(walls).toHaveCount(4);

  // One action, one undo: both walls come back together.
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(walls).toHaveCount(6);
});

test('selects several objects with a rubber band', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const canvas = page.locator('.plan-canvas');
  // The pointer is driven in viewport coordinates, so the canvas has to be
  // where the test thinks it is.
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const at = (fx: number, fy: number) => ({
    x: box.x + box.width * fx,
    y: box.y + box.height * fy,
  });

  // Dragged rightwards, the band takes what it encloses.
  const from = at(0.02, 0.04);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const halfway = at(0.5, 0.5);
  await page.mouse.move(halfway.x, halfway.y, { steps: 4 });
  await expect(page.locator('#preview\\:selection-box')).toHaveCount(1);
  await expect(page.locator('.canvas-status')).toContainText('fenêtre');
  const to = at(0.98, 0.96);
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();

  const selection = page.locator('.selection-list li');
  await expect(selection.first()).toBeVisible();
  expect(await selection.count()).toBeGreaterThan(1);
  // The band is gone once released.
  await expect(page.locator('#preview\\:selection-box')).toHaveCount(0);

  // Escape clears the selection once nothing else is in progress.
  await page.keyboard.press('Escape');
  await expect(page.locator('.selection-list li')).toHaveCount(0);

  // Dragged leftwards, the band takes everything it touches: a band far too
  // small to enclose a wall still catches the ones crossing it.
  const start = at(0.55, 0.55);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const back = at(0.45, 0.45);
  await page.mouse.move(back.x, back.y, { steps: 4 });
  await expect(page.locator('.canvas-status')).toContainText('capture');
  await page.mouse.up();
  await expect(
    page.locator('.inspector-subject, .selection-list'),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('changes a property of several objects in one go', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  // A point on each partition, away from where the two of them cross: their
  // bounding boxes share that crossing, and clicking it twice would select and
  // then deselect the same wall.
  const along = async (id: string, fx: number, fy: number) => {
    const shape = (await page.locator(`[id="wall:${id}"]`).boundingBox())!;
    return {
      x: shape.x - box.x + shape.width * fx,
      y: shape.y - box.y + shape.height * fy,
    };
  };
  await canvas.click({ position: await along('wall-partition-v', 0.5, 0.2) });
  await canvas.click({
    position: await along('wall-partition-h', 0.2, 0.5),
    modifiers: ['ControlOrMeta'],
  });
  await expect(page.locator('.selection-list li')).toHaveCount(2);

  // Both are partitions, so the shared field shows that value rather than
  // "different"; their lengths differ, and that field says so.
  const role = page.getByLabel('Rôle');
  await expect(role).toHaveValue('INTERIOR');
  await expect(page.getByLabel('Longueur')).toHaveAttribute(
    'placeholder',
    'valeurs différentes',
  );

  await role.selectOption('EXTERIOR');
  await expect(page.getByRole('status')).toContainText('2 objets');

  // One decision, one undo: both walls go back together.
  await canvas.click({ position: await along('wall-partition-v', 0.5, 0.2) });
  await expect(page.getByLabel('Rôle')).toHaveValue('EXTERIOR');
  // One decision, one undo: clicking a member of the selection beforehand
  // selects it and writes nothing.
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.getByLabel('Rôle')).toHaveValue('INTERIOR');
  expect(errors).toEqual([]);
});

test('reaches tools, workspaces and objects from the command palette', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await page.locator('.plan-canvas').click({ position: { x: 5, y: 5 } });

  // A tool, by its name.
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Palette de commandes' });
  await expect(palette).toBeVisible();
  await palette.getByLabel('Chercher une commande').fill('mur');
  // Named rather than first-in-the-list: the palette holds tools, spaces,
  // disciplines, presets, levels and objects now, and « le premier résultat »
  // is not what a person means when they mean the wall tool.
  await palette
    .locator('.palette-results button')
    .filter({ has: page.locator('.palette-group', { hasText: 'Outils' }) })
    .filter({ hasText: /^Mur/u })
    .first()
    .click();
  await expect(palette).toBeHidden();
  await expect(toolButton(page, 'Mur')).toHaveAttribute('aria-pressed', 'true');

  // A workspace, without accents and without knowing where its button is.
  await page.keyboard.press('Control+k');
  await page.getByLabel('Chercher une commande').fill('reseaux');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Réseaux du projet' }),
  ).toBeVisible();

  // An object of the storey being drawn, by the name the inspector gives it.
  await page.keyboard.press('Control+k');
  await page.getByLabel('Chercher une commande').fill('wall-south');
  await page.keyboard.press('Enter');
  await expect(page.locator('.inspector-subject')).toContainText('wall-south');

  // Escape closes it without running anything.
  await page.keyboard.press('Control+k');
  await expect(
    page.getByRole('dialog', { name: 'Palette de commandes' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('dialog', { name: 'Palette de commandes' }),
  ).toBeHidden();
  await expect(page.locator('.inspector-subject')).toContainText('wall-south');
  expect(errors).toEqual([]);
});

test('carries a selection across the plan by dragging it', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  // La mise en page se fige avant qu'on relève une position dans le plan.
  await openInspector(page);
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const frame = (await canvas.boundingBox())!;
  const onWall = async (id: string, fx: number, fy: number) => {
    const shape = (await page.locator(`[id="wall:${id}"]`).boundingBox())!;
    return {
      x: shape.x - frame.x + shape.width * fx,
      y: shape.y - frame.y + shape.height * fy,
    };
  };

  const grip = await onWall('wall-partition-v', 0.5, 0.2);
  await canvas.click({ position: grip });
  await expect(page.locator('.inspector-subject')).toContainText(
    'wall-partition-v',
  );
  const lengthBefore = await page
    .getByRole('spinbutton', { name: 'Longueur (mm)' })
    .inputValue();

  // Pressing on something already selected carries it rather than starting a
  // rubber band. The frame is read again here: selecting redraws the panels,
  // and a box measured before that is a box from another layout.
  const held = (await canvas.boundingBox())!;
  await page.mouse.move(held.x + grip.x, held.y + grip.y);
  await page.mouse.down();
  await page.mouse.move(held.x + grip.x + 60, held.y + grip.y + 20, {
    steps: 6,
  });
  // The wall is shown where it would land before it is dropped.
  await expect(page.locator('[id^="preview:move:"]').first()).toBeVisible();
  await page.mouse.up();
  await expect(page.getByRole('status')).toContainText('Déplacer');

  // Carried, not reshaped: the wall is the same length where it lands.
  await expect(
    page.getByRole('spinbutton', { name: 'Longueur (mm)' }),
  ).toHaveValue(lengthBefore);
  await expect(page.locator('[id^="preview:move:"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('annulée');
  expect(errors).toEqual([]);
});

test('remembers how wide the panels were made', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const sidebar = page.locator('#workspace-sidebar');
  const before = (await sidebar.boundingBox())!.width;

  // The edge between the panel and the drawing is a separator: the arrow keys
  // move it for anyone not using a pointer.
  const edge = page.getByRole('separator', {
    name: 'Redimensionner le panneau de navigation',
  });
  await edge.focus();
  for (let press = 0; press < 4; press += 1)
    await page.keyboard.press('ArrowRight');
  await expect
    .poll(async () => (await sidebar.boundingBox())!.width)
    .toBeGreaterThan(before);
  const widened = (await sidebar.boundingBox())!.width;

  // Rien n'est sélectionné : l'inspecteur s'est replié tout seul et a rendu sa
  // largeur au dessin. Le bouton « Inspecteur » l'épingle ouvert pour qui veut
  // l'avoir sous les yeux d'abord.
  const canvas = page.locator('.canvas-panel');
  await expect(page.locator('#inventory')).toBeHidden();
  const plan = (await canvas.boundingBox())!.width;
  const inspectorToggle = page.getByRole('button', {
    name: 'Inspecteur',
    exact: true,
  });
  await inspectorToggle.click();
  await expect(page.locator('#inventory')).toBeVisible();
  await expect
    .poll(async () => (await canvas.boundingBox())!.width)
    .toBeLessThan(plan);

  // Le refermer est une préférence : elle survit au rechargement, comme la
  // largeur du panneau gauche. Elle est dans le navigateur, jamais dans le
  // projet.
  await inspectorToggle.click();
  await expect(page.locator('#inventory')).toBeHidden();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Fichier' })).toBeVisible();
  await expect(page.locator('#inventory')).toBeHidden();
  expect((await sidebar.boundingBox())!.width).toBeCloseTo(widened, 0);

  await inspectorToggle.click();
  await expect(page.locator('#inventory')).toBeVisible();
  expect(errors).toEqual([]);
});

test('duplicates a selection and leaves the copies selected', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const walls = page.locator('[data-role="WALL_CUT"][id^="wall:"]');
  await expect(walls).toHaveCount(6);
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const frame = (await canvas.boundingBox())!;
  const shape = (await page
    .locator('[id="wall:wall-partition-v"]')
    .boundingBox())!;
  await canvas.click({
    position: {
      x: shape.x - frame.x + shape.width * 0.5,
      y: shape.y - frame.y + shape.height * 0.2,
    },
  });
  await expect(page.locator('.inspector-subject')).toContainText(
    'wall-partition-v',
  );

  await page.keyboard.press('Control+d');
  await expect(page.getByRole('status')).toContainText('Dupliquer');
  await expect(walls).toHaveCount(7);
  // What is selected afterwards is the copy, not the original: the next edit
  // has to land on what was just created.
  await expect(page.locator('.inspector-subject')).not.toContainText(
    'wall-partition-v',
  );

  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(walls).toHaveCount(6);
  expect(errors).toEqual([]);
});

test('turns and reflects a selection about its own centre', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const frame = (await canvas.boundingBox())!;
  const shape = (await page
    .locator('[id="wall:wall-partition-h"]')
    .boundingBox())!;
  await canvas.click({
    position: {
      x: shape.x - frame.x + shape.width * 0.2,
      y: shape.y - frame.y + shape.height * 0.5,
    },
  });
  await expect(page.locator('.inspector-subject')).toContainText(
    'wall-partition-h',
  );
  const before = await page
    .getByRole('spinbutton', { name: 'Angle (°)' })
    .inputValue();
  const length = await page
    .getByRole('spinbutton', { name: 'Longueur (mm)' })
    .inputValue();

  await page.getByRole('button', { name: /^Pivoter 90°/ }).click();
  await expect(page.getByRole('status')).toContainText('Pivoter');
  // A quarter turn changes the bearing and not the length.
  await expect(
    page.getByRole('spinbutton', { name: 'Angle (°)' }),
  ).not.toHaveValue(before);
  await expect(
    page.getByRole('spinbutton', { name: 'Longueur (mm)' }),
  ).toHaveValue(length);

  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Angle (°)' })).toHaveValue(
    before,
  );

  await page.getByRole('button', { name: /^Miroir gauche-droite/ }).click();
  await expect(page.getByRole('status')).toContainText('Retourner');
  await expect(
    page.getByRole('spinbutton', { name: 'Longueur (mm)' }),
  ).toHaveValue(length);
  expect(errors).toEqual([]);
});

test('offsets, joins and aligns walls from the plan', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const walls = page.locator('[data-role="WALL_CUT"][id^="wall:"]');
  // The canvas moves when the toolbar of the active tool changes height, so
  // where it is now is read each time rather than once.
  const onWall = async (id: string, fx: number, fy: number) => {
    const frame = (await canvas.boundingBox())!;
    const shape = (await page.locator(`[id="wall:${id}"]`).boundingBox())!;
    return {
      x: shape.x - frame.x + shape.width * fx,
      y: shape.y - frame.y + shape.height * fy,
    };
  };

  // Décaler : le mur, puis le côté et la distance.
  await chooseTool(page, 'Décaler');
  // A quarter of the way along, away from the partition that crosses this wall
  // at its middle.
  const source = await onWall('wall-south', 0.25, 0.5);
  await canvas.click({ position: source });
  await canvas.click({ position: { x: source.x, y: source.y + 60 } });
  await expect(page.getByRole('status')).toContainText('Décaler un mur');
  await expect(walls).toHaveCount(7);

  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(walls).toHaveCount(6);

  // Aligner demande au moins deux objets, et le dit.
  await chooseTool(page, 'Sélection');
  await canvas.click({ position: await onWall('wall-partition-v', 0.5, 0.2) });
  await expect(
    page.getByRole('button', { name: 'Aligner à gauche' }),
  ).toBeDisabled();
  await canvas.click({
    position: await onWall('wall-west', 0.5, 0.3),
    modifiers: ['ControlOrMeta'],
  });
  await page.getByRole('button', { name: 'Aligner à gauche' }).click();
  await expect(page.getByRole('status')).toContainText('Aligner à gauche');

  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('annulée');
  expect(errors).toEqual([]);
});

test('draws a wall of a typed length, at the cursor', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await hidePlacedComponents(page);
  const walls = page.locator('[data-role="WALL_CUT"][id^="wall:"]');
  await expect(walls).toHaveCount(6);
  const wallIds = async (): Promise<readonly string[]> =>
    walls.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('id') ?? ''),
    );
  const before = await wallIds();
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();

  await chooseTool(page, 'Mur');
  await canvas.click({ position: { x: 80, y: 300 } });
  // The fields follow the point being placed rather than sitting at the top of
  // the window.
  const dynamic = page.locator('.dynamic-input');
  await expect(dynamic).toBeVisible();

  // A length typed with its unit, then Enter: the wall is placed where the
  // numbers say, not where the pointer happens to be.
  await page.getByLabel('Longueur du tracé').fill('4,5 m');
  await page.getByLabel('Angle du tracé').fill('0');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Ajouter un mur');
  await expect(walls).toHaveCount(7);
  await expect(dynamic).toBeHidden();

  // The wall measures what was typed. Where to click is read from where the
  // wall was actually drawn: how many pixels a metre takes depends on how wide
  // the canvas is, and that is a layout decision, not a fact of the wall.
  await chooseTool(page, 'Sélection');
  const drawnId = (await wallIds()).find((id) => !before.includes(id));
  expect(drawnId).toBeDefined();
  const drawnBox = (await page.locator(`[id="${drawnId!}"]`).boundingBox())!;
  const canvasBox = (await canvas.boundingBox())!;
  await canvas.click({
    position: {
      x: drawnBox.x - canvasBox.x + drawnBox.width / 2,
      y: drawnBox.y - canvasBox.y + drawnBox.height / 2,
    },
  });
  await expect(
    page.getByRole('spinbutton', { name: 'Longueur (mm)' }),
  ).toHaveValue('4500');

  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(walls).toHaveCount(6);
  expect(errors).toEqual([]);
});

test('chains a run of walls entirely from the typed fields', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const walls = page.locator('[data-role="WALL_CUT"][id^="wall:"]');
  await expect(walls).toHaveCount(6);
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();

  await chooseTool(page, 'Mur continu');
  await canvas.click({ position: { x: 80, y: 320 } });
  const dynamic = page.locator('.dynamic-input');
  await expect(dynamic).toBeVisible();

  // Enter placed the point and, on the second one, also ended the run: a chain
  // drawn from the fields could never have three corners. Placing a point and
  // finishing a run are two decisions, so they are two gestures.
  for (const [lengthMm, angleDeg] of [
    ['3000', '0'],
    ['2000', '90'],
    ['3000', '180'],
  ] as const) {
    await page.getByLabel('Longueur du tracé').fill(lengthMm);
    await page.getByLabel('Angle du tracé').fill(angleDeg);
    await page.keyboard.press('Enter');
  }
  await expect(dynamic).toBeVisible();
  await expect(page.locator('.canvas-status')).toContainText('4 point(s)');

  await dynamic.getByRole('button', { name: /Terminer/ }).click();
  await expect(page.getByRole('status')).toContainText('Ajouter 3 murs');
  await expect(walls).toHaveCount(9);
  expect(errors).toEqual([]);
});

test('offers only the field the tool actually takes', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();

  // An axis of symmetry has a direction that matters and a length that does
  // not; the tool has always said so, and both fields were shown all the same.
  await chooseTool(page, 'Sélection');
  // Aimed at a wall the plan actually holds rather than at a pixel: how many
  // pixels a metre takes depends on how wide the canvas is.
  const frame = (await canvas.boundingBox())!;
  const south = (await page.locator('[id="wall:wall-south"]').boundingBox())!;
  await canvas.click({
    position: {
      x: south.x - frame.x + south.width * 0.4,
      y: south.y - frame.y + south.height / 2,
    },
  });
  await chooseTool(page, 'Miroir');
  await canvas.click({ position: { x: 120, y: 200 } });
  const dynamic = page.locator('.dynamic-input');
  await expect(dynamic).toBeVisible();
  await expect(page.getByLabel('Angle du tracé')).toBeVisible();
  await expect(page.getByLabel('Longueur du tracé')).toBeHidden();
  expect(errors).toEqual([]);
});

test('writes on the plan what the model does not say', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();

  // A drawing carries what the building is and what the person drawing it
  // wants read; only the first had anywhere to live.
  const options = page.getByRole('group', { name: 'Options de l’outil' });
  await chooseTool(page, 'Annotation');
  await options.getByLabel('Texte').fill('Existant à démolir');
  await canvas.click({ position: { x: 200, y: 260 } });
  await expect(page.getByRole('status')).toContainText(
    'Ajouter une annotation',
  );
  await expect(page.locator('[id^="note:"]')).toHaveCount(1);

  // It is an object of the editor like any other: selected, described, edited.
  await chooseTool(page, 'Sélection');
  await canvas.click({ position: { x: 200, y: 260 } });
  await expect(page.locator('.inspector-subject h3')).toContainText(
    'Existant à démolir',
  );
  await expect(page.locator('.inspector-subject')).toContainText('personne');

  // An annotation with nothing written on it is an invisible object.
  await chooseTool(page, 'Annotation');
  await options.getByLabel('Texte').fill('');
  await canvas.click({ position: { x: 240, y: 300 } });
  await expect(page.getByRole('status')).toContainText('texte');
  await expect(page.locator('[id^="note:"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('edits a measurement written on the drawing itself', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const frame = (await canvas.boundingBox())!;
  const shape = (await page
    .locator('[id="wall:wall-partition-v"]')
    .boundingBox())!;
  await canvas.click({
    position: {
      x: shape.x - frame.x + shape.width * 0.5,
      y: shape.y - frame.y + shape.height * 0.2,
    },
  });

  // The length is written on the wall, not only in the panel on the right.
  const onPlan = page.getByLabel('Longueur sur le plan');
  await expect(onPlan).toBeVisible();
  const before = await onPlan.inputValue();
  expect(Number(before)).toBeGreaterThan(0);

  await onPlan.fill('6000');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('appliqué');
  await expect(
    page.getByRole('spinbutton', { name: 'Longueur (mm)' }),
  ).toHaveValue('6000');

  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.getByLabel('Longueur sur le plan')).toHaveValue(before);
  expect(errors).toEqual([]);
});

test('reaches an object through the project tree', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await openModelTree(page);
  const tree = page.getByRole('navigation', {
    name: 'Arborescence du projet',
  });
  await expect(tree).toBeVisible();

  // The families of the storey being drawn, with what they hold.
  await tree.getByText(/^Murs/).click();
  const wall = tree.getByRole('button', { name: 'wall-south' });
  await expect(wall).toBeVisible();
  await wall.click();
  await expect(page.locator('.inspector-subject')).toContainText('wall-south');

  // Rooms read as their names rather than as identifiers.
  await tree.getByText(/^Pièces/).click();
  await expect(tree.getByRole('button', { name: 'Séjour' })).toBeVisible();

  // L'étage sur lequel on dessine se lit au-dessus du dépliage, pas dedans :
  // ce n'est pas un contenu qu'on range, c'est où va ce qu'on trace.
  await expect(
    page
      .getByRole('group', { name: 'Niveaux', exact: true })
      .getByRole('button', { name: 'Rez-de-chaussée' }),
  ).toHaveAttribute('aria-current', 'true');
  expect(errors).toEqual([]);
});

test('reaches a column and a component through the project tree', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;

  // A column, then a radiator: the two families whose tree lines used to send
  // « member-1 Poteau member-1 » where an identifier was expected, so that
  // clicking them selected nothing at all.
  await chooseTool(page, 'Poteau');
  await page.getByLabel('Élément').selectOption('COLUMN');
  await canvas.click({ position: { x: box.width * 0.4, y: box.height * 0.4 } });
  await expect(page.locator('[id^="structure:member-"]')).toHaveCount(1);

  /*
   * Un radiateur se pose dans Systèmes, et un poteau dans Bâtiment : chaque
   * objet a un espace propriétaire, et poser un appareil de chauffage depuis
   * l'onglet du bâti est refusé. Le changement d'étape n'est pas une
   * contorsion du test, c'est la règle qu'il traverse.
   */
  await chooseTool(page, 'Composant');
  // L'outil « Composant » vit dans Aménagement, et il pose n'importe quelle
  // catégorie : un appareil de chauffage appartient aux Systèmes, donc c'est
  // de là qu'on le pose. Choisir l'outil, puis l'espace qui possède ce qu'il
  // va poser.
  await openStage(page, 'Systèmes');
  await page.getByLabel('Catégorie').selectOption('HEATING');
  // A name the reference house does not already hold: the tree lists what is
  // in the project, and two lines reading the same thing prove nothing about
  // which one was clicked.
  await page.getByLabel('Nom').fill('Radiateur d’essai');
  await canvas.click({
    position: { x: box.width * 0.3, y: box.height * 0.35 },
  });
  await expect(page.getByRole('status')).toContainText('composant');

  await openModelTree(page);

  const tree = page.getByRole('navigation', {
    name: 'Arborescence du projet',
  });
  await tree.getByText(/^Structure/).click();
  await tree.getByRole('button', { name: /^Poteau / }).click();
  await expect(page.locator('.inspector-subject h3')).toContainText('Poteau');

  await tree.getByText(/^Composants/).click();
  await tree.getByRole('button', { name: 'Radiateur d’essai' }).click();
  await expect(page.locator('.inspector-subject h3')).toContainText(
    'Radiateur d’essai',
  );
  expect(errors).toEqual([]);
});

test('offers on an object only what its family can do', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;

  // A room is the space its walls enclose: it neither moves, nor turns, nor
  // is copied. Offering the three and refusing them afterwards reads as a
  // defect; greying them out reads as a property of the room, which it is.
  const living = (await page
    .locator('[id="space:space-living"]')
    .boundingBox())!;
  await canvas.click({
    button: 'right',
    position: {
      x: living.x - box.x + living.width / 2,
      y: living.y - box.y + living.height / 2,
    },
  });
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(page.locator('.inspector-subject h3')).toContainText('Séjour');
  for (const action of ['Dupliquer', 'Pivoter d’un quart de tour', 'Retourner'])
    await expect(menu.getByRole('menuitem', { name: action })).toBeDisabled();
  // Framing and deleting are the application's, not the family's, and stay.
  await expect(
    menu.getByRole('menuitem', { name: 'Cadrer sur cet objet' }),
  ).toBeEnabled();
  // The quick transformations of the context bar follow the same declaration.
  // Asked while the room is still selected: the bar carries what applies to
  // the selection, so an empty selection carries nothing to ask about.
  await expect(
    page.getByRole('button', { name: /^Pivoter 90°/ }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('chooses which contour a slab is built from', async ({ page }) => {
  await loadDemo(page);
  await openDestination(page, 'Niveaux et pièces');
  const contour = page.getByLabel('Contour');
  await expect(contour).toBeVisible();
  const options = await contour.locator('option').allTextContents();
  expect(options.length).toBeGreaterThan(1);

  // The second contour, explicitly: the panel used to take the first one
  // whatever the user had chosen.
  await contour.selectOption({ index: 1 });
  const chosenAreaM2 = Number(
    options[1]!.split('—')[1]!.trim().split(' m²')[0]!.replace(',', '.'),
  );
  await page.getByRole('button', { name: 'Dalle depuis le contour' }).click();
  await expect(page.getByRole('status')).toContainText('appliqué');

  // The saved project is the proof: the slab carries the polygon of the
  // contour that was chosen, not of the first one detected.
  const download = page.waitForEvent('download');
  await fileAction(page, 'Exporter le JSON');
  const saved = JSON.parse(
    await readFile(await (await download).path(), 'utf8'),
  ) as {
    project: {
      building: {
        levels: readonly {
          slabs: readonly {
            polygon: { outer: readonly { x: number; y: number }[] };
          }[];
        }[];
      };
    };
  };
  const slabs = saved.project.building.levels[0]!.slabs;
  const outer = slabs.at(-1)!.polygon.outer;
  const areaM2 =
    Math.abs(
      outer.reduce((total, point, index) => {
        const next = outer[(index + 1) % outer.length]!;
        return total + point.x * next.y - next.x * point.y;
      }, 0) / 2,
    ) / 1_000_000;
  expect(areaM2).toBeCloseTo(chosenAreaM2, 1);
});

test('asks before replacing a project that has unexported changes', async ({
  page,
}) => {
  await loadDemo(page);
  await chooseTool(page, 'Mur');
  const canvas = page.locator('.plan-canvas');
  await canvas.click({ position: { x: 120, y: 380 } });
  await canvas.click({ position: { x: 420, y: 380 } });
  await expect(page.locator('.save-state')).not.toHaveText('Enregistré');

  await fileAction(page, 'Nouveau projet');
  const prompt = page.getByRole('alertdialog');
  await expect(prompt).toContainText('n’ont pas été exportées');
  // Cancelling keeps the work.
  await prompt.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.locator('[data-role="WALL_CUT"][id^="wall:"]')).toHaveCount(
    7,
  );

  await fileAction(page, 'Nouveau projet');
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Continuer sans exporter' })
    .click();
  await page.getByRole('button', { name: 'Créer le projet' }).click();
  await expect(page.getByRole('status')).toContainText('Nouveau projet');
});

test('refuses to write a container without the climate the project names', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto('/');
  // The reference project names the climate profile it was calculated on. Read
  // as plain JSON, that dataset is not in the session — and a container written
  // now would open elsewhere calculating nothing.
  await page.setInputFiles(
    'input[type="file"]',
    'examples/reference-house/reference.houseproj.json',
  );
  await expect(page.getByRole('status')).toContainText('chargé et validé');

  await fileAction(page, 'Sauvegarder');
  const refusal = page.getByRole('alertdialog');
  await expect(refusal).toContainText('reference-temperate');
  await expect(refusal).toContainText('Importez ce jeu de données');
  await expect(page.getByRole('status')).toContainText('Export impossible');

  // Nothing was written: the project is still the one that was opened.
  await refusal.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.locator('[data-role="WALL_CUT"][id^="wall:"]')).toHaveCount(
    6,
  );
  expect(errors).toEqual([]);
});

test('creates a project on a page, storey by storey', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/');
  await fileAction(page, 'Nouveau projet');
  const creation = page.getByRole('main', { name: 'De quoi s’agit-il ?' });
  await expect(creation).toBeVisible();
  // A page, not a modal: nothing of the application is left half-usable behind
  // it.
  await expect(page.locator('.workspace-grid')).toHaveCount(0);

  await creation.getByLabel('Nom du projet').fill('Maison des Lilas');
  await creation.getByLabel('Auteur').fill('A. Martin');

  // The stack says two basements, a floor and converted attics — none of which
  // « a count plus one height plus a checkbox » can say.
  await creation.getByRole('button', { name: 'Le bâtiment' }).click();
  await creation.getByRole('button', { name: '+ Sous-sol' }).click();
  await creation.getByRole('button', { name: '+ Étage' }).click();
  await creation.getByRole('button', { name: '+ Combles' }).click();
  await creation
    .getByLabel('Hauteur du niveau Sous-sol en millimètres')
    .fill('2700');

  // The coordinates are folded away, and « à déterminer » is a real answer.
  await creation.getByRole('button', { name: 'Le lieu' }).click();
  await creation.getByText('Coordonnées précises').click();
  await creation.getByLabel('Latitude (°)').fill('48.85');
  await creation.getByLabel('Longitude (°)').fill('2.35');

  await creation.getByRole('button', { name: 'Créer le projet' }).click();

  await expect(page.getByRole('status')).toContainText('4 niveau(x)');
  await openDestination(page, 'Projet');
  await expect(page.getByLabel('Nom du projet')).toHaveValue(
    'Maison des Lilas',
  );
  await expect(page.getByLabel('Latitude')).toHaveValue('48.85');
  // Les quatre niveaux sont dans l'arborescence, qui est le seul endroit où
  // l'on change d'étage.
  await openDestination(page, 'Plan');
  await expect(
    page
      .getByRole('group', { name: 'Niveaux', exact: true })
      .getByRole('button'),
  ).toHaveText(['Sous-sol', 'Rez-de-chaussée', 'Étage', 'Combles']);
  expect(errors).toEqual([]);
});

/**
 * The whole cycle, from an empty page back to a file on disk.
 *
 * Créer, sauvegarder, fermer, rouvrir, modifier, recalculer, exporter. Every
 * one of these steps is covered somewhere on its own, and each of them passing
 * says nothing about the one that matters: that what came back out of the file
 * is the thing that went in, and that changing it afterwards still moves the
 * numbers. A project that survives a round trip but stops recalculating is a
 * project the application has quietly turned into a picture.
 */
test('creates, saves, closes, reopens, changes, recomputes and exports', async ({
  page,
}) => {
  const errors = watchConsole(page);

  // Créer — a house of its own, not the demonstration one.
  await page.goto('/');
  await fileAction(page, 'Nouveau projet');
  const creation = page.getByRole('main', { name: 'De quoi s’agit-il ?' });
  await creation.getByLabel('Nom du projet').fill('Maison du cycle');
  await creation.getByRole('button', { name: 'Le bâtiment' }).click();
  await creation.getByRole('button', { name: '+ Étage' }).click();
  await creation.getByRole('button', { name: 'Le lieu' }).click();
  await creation.getByText('Coordonnées précises').click();
  await creation.getByLabel('Latitude (°)').fill('45.75');
  await creation.getByLabel('Longitude (°)').fill('4.85');
  await creation.getByRole('button', { name: 'Créer le projet' }).click();
  await expect(page.getByRole('status')).toContainText('2 niveau(x)');

  // Something to compute on: four walls enclosing a rectangle.
  await openDestination(page, 'Plan');
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  await chooseTool(page, 'Murs rectangle');
  await canvas.click({ position: { x: 120, y: 120 } });
  await canvas.click({ position: { x: 420, y: 320 } });
  const walls = page.locator('[data-role="WALL_CUT"][id^="wall:"]');
  await expect(walls).toHaveCount(4);

  // Sauvegarder — the container the application writes.
  const first = page.waitForEvent('download');
  await fileAction(page, 'Sauvegarder');
  const saved = await (await first).path();
  expect(saved).not.toBeNull();
  await expect(page.getByRole('status')).toContainText('.houseproj');

  // Fermer — a reload with the local snapshot thrown away is as close to
  // closing the application as a browser gets.
  await page.reload();
  const prompt = page.getByRole('alertdialog');
  if ((await prompt.count()) > 0)
    await prompt.getByRole('button', { name: 'Ignorer et supprimer' }).click();
  await expect(page.getByRole('status')).toContainText('Nouveau projet');
  await expect(walls).toHaveCount(0);

  // Rouvrir — and the house is the one that was saved, name and all.
  await page.setInputFiles('input[type="file"]', saved);
  await expect(page.getByRole('status')).toContainText('chargé et validé');
  await expect(walls).toHaveCount(4);
  await openDestination(page, 'Projet');
  await expect(page.getByLabel('Nom du projet')).toHaveValue('Maison du cycle');

  // The quantities of the house as it came back.
  await openDestination(page, 'Quantités');
  const rows = page.locator('.library-table tbody tr');
  await expect(rows.first()).toBeVisible();
  const before = await rows.allTextContents();

  // Modifier — a fifth wall across the middle.
  await openDestination(page, 'Plan');
  await canvas.scrollIntoViewIfNeeded();
  await chooseTool(page, 'Mur');
  await canvas.click({ position: { x: 140, y: 220 } });
  await canvas.click({ position: { x: 400, y: 220 } });
  await expect(walls).toHaveCount(5);

  // Recalculer — the nomenclature is not the one of the house before the wall.
  await openDestination(page, 'Quantités');
  await expect(rows.first()).toBeVisible();
  await expect
    .poll(async () => (await rows.allTextContents()).join('|'), {
      timeout: 20_000,
    })
    .not.toBe(before.join('|'));

  // Exporter — a document, out of the application and onto the disk.
  const second = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter en CSV' }).click();
  expect((await second).suggestedFilename()).toContain('nomenclature');

  expect(errors).toEqual([]);
});

test('shows nothing above the plan until something is being done', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const bar = page.locator('.context-tool-bar');
  // Nothing chosen, nothing selected: the bar shows nothing. It keeps its
  // place — a strip that comes and goes moves the drawing under the pointer —
  // but it holds no control at all.
  await expect(bar).toHaveClass(/is-empty/u);
  await expect(bar.getByRole('button')).toHaveCount(0);

  // Les outils vivent dans le sommaire de la colonne, une sous-partie à la
  // fois : ce que Bâtiment › Murs met sous la main, et non les vingt-cinq du
  // registre ni les quatre sous-parties dépliées ensemble.
  const tools = page.locator('#workspace-sidebar, .tool-header');
  const parts = page.getByRole('navigation', { name: 'Sous-parties' });
  await expect(
    parts.getByRole('button', { name: 'Mur', exact: true }),
  ).toBeVisible();
  await expect(
    parts.getByRole('button', { name: 'Porte', exact: true }),
  ).toBeHidden();
  // Et les autres sont à un dépliage, dans la même colonne : ouvrir l'une
  // referme la précédente, parce qu'on ne travaille qu'à un endroit.
  await openSection(page, 'Ouvertures');
  await expect(
    parts.getByRole('button', { name: 'Porte', exact: true }),
  ).toBeVisible();
  await expect(
    parts.getByRole('button', { name: 'Mur', exact: true }),
  ).toBeHidden();
  await openSection(page, 'Murs');
  await chooseTool(page, 'Mur');
  await expect(bar).toContainText('Mur');
  // What the tool lets one decide before drawing sits under the tool itself,
  // in the panel: choosing an assembly is part of choosing the wall tool.
  await expect(tools.getByLabel('Assemblage')).toBeVisible();

  // Finishing empties it again.
  await bar.getByRole('button', { name: 'Quitter l’outil' }).click();
  await expect(bar).toHaveClass(/is-empty/u);

  // Selecting something brings back what applies to the selection, and only
  // that.
  const canvas = page.locator('.plan-canvas');
  const box = (await canvas.boundingBox())!;
  const east = (await page.locator('[id="wall:wall-east"]').boundingBox())!;
  await canvas.click({
    position: {
      x: east.x - box.x + east.width / 2,
      y: east.y - box.y + east.height * 0.25,
    },
  });
  await expect(bar.getByRole('group', { name: 'Alignement' })).toBeVisible();
  await expect(bar).not.toContainText('Quitter l’outil');

  // Un seul écran pour tout le monde : ce que l'étape ne propose pas est à un
  // dépliage, pas à un changement de mode. Une étape filtre ce qui est
  // proposé ; elle ne restreint jamais ce qui est possible.
  await expect(page.getByLabel('Niveau d’interface')).toHaveCount(0);
  const more = tools.locator('.tool-more > summary');
  await expect(more).toBeVisible();
  await more.click();
  // Le dépliage ne tient plus que les gestes communs — mesurer, coter,
  // annoter — qui ne sont d'aucune sous-partie et servent dans toutes.
  await expect(tools.getByText(/^Communs/u)).toBeVisible();
  // Il ne redouble plus le sommaire de la colonne : ce que la sous-partie
  // pose se prend là où on le lit, à un seul endroit.
  await expect(
    tools.getByRole('region', { name: 'Outils · Ouvertures' }),
  ).toHaveCount(0);
  // Et l'espace du bâtiment n'emprunte rien à celui du terrain.
  await expect(
    tools.getByRole('button', { name: 'Parcelle', exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('narrows the design scope without losing anything', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await openDestination(page, 'Projet');
  const scope = page.getByRole('region', { name: 'Périmètre de conception' });

  // The demonstration house carries electrical runs; the trade cannot be set
  // aside even when the boxes say so.
  await scope.getByRole('button', { name: 'Architecture seule' }).click();
  await expect(page.getByRole('status')).toContainText('périmètre');
  await expect(scope).toContainText('ce projet en contient déjà');

  // Nothing was deleted: the networks are where they were.
  await openDestination(page, 'Réseaux');
  await expect(page.locator('.network-layout')).toBeVisible();
  await expect(
    page.locator('.network-layout').getByRole('option').first(),
  ).toBeAttached();

  // The settings screen sorts the modules rather than hiding them.
  await openDestination(page, 'Projet');
  await expect(
    page.locator('#settings-module optgroup[label="Hors périmètre"]'),
  ).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('draws the starting footprint with ordinary walls', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/');
  await fileAction(page, 'Nouveau projet');
  const creation = page.getByRole('main', { name: 'De quoi s’agit-il ?' });
  // « Page blanche » lands on the plan with nothing in the way; « être
  // guidé » lands in Projet with the guide open. The mode decides what
  // happens next, not what the file holds.
  await creation
    .getByRole('radio', { name: 'Partir d’une page blanche' })
    .check();
  await creation.getByRole('button', { name: 'Le bâtiment' }).click();
  // The default is to draw it oneself; a shape is a choice, not a starting
  // point imposed on everyone.
  await expect(
    creation.getByRole('radio', { name: 'Je dessinerai moi-même' }),
  ).toBeChecked();
  await creation.getByRole('radio', { name: 'En L' }).check();
  await creation.getByRole('button', { name: 'Créer le projet' }).click();

  await expect(page.getByRole('status')).toContainText('emprise de départ');
  // Six sides, six walls — and they are walls like any other.
  await expect(page.locator('[data-role="WALL_CUT"][id^="wall:"]')).toHaveCount(
    6,
  );
  // One press takes the whole footprint back: the walls and the slab arrived
  // together, so they leave together.
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('annulée');
  await expect(page.locator('[data-role="WALL_CUT"][id^="wall:"]')).toHaveCount(
    0,
  );
  expect(errors).toEqual([]);
});

test('edits the selected wall from the inspector', async ({ page }) => {
  await loadDemo(page);
  const canvas = page.locator('.plan-canvas');
  const box = (await canvas.boundingBox())!;
  // The east wall carries no opening and no partition crosses it.
  const east = (await page.locator('[id="wall:wall-east"]').boundingBox())!;
  await canvas.click({
    position: {
      x: east.x - box.x + east.width / 2,
      y: east.y - box.y + east.height * 0.25,
    },
  });
  const inspector = page.locator('.inspector-subject');
  await expect(inspector).toContainText('wall-east');
  await expect(inspector).toContainText('EXTERIOR');

  // A select is a decision: it applies at once.
  await inspector.getByLabel('Rôle').selectOption('INTERIOR');
  await expect(page.getByRole('status')).toContainText('Modifier un mur');
  await expect(inspector).toContainText('INTERIOR');

  // A typed value is committed on Enter, not on every keystroke.
  const height = inspector.getByLabel('Hauteur (mm)');
  await height.fill('2700');
  await height.press('Enter');
  await expect(inspector).toContainText('2.70 m');

  // Both changes are undoable, one command at a time.
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(inspector).toContainText('2.60 m');
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(inspector).toContainText('EXTERIOR');
});

test('refuses an opening that would no longer fit its wall', async ({
  page,
}) => {
  await loadDemo(page);
  const canvas = page.locator('.plan-canvas');
  const box = (await canvas.boundingBox())!;
  const opening = (await page
    .locator('[data-layer="architecture.openings"] > *')
    .first()
    .boundingBox())!;
  await canvas.click({
    position: {
      x: opening.x - box.x + opening.width / 2,
      y: opening.y - box.y + opening.height / 2,
    },
  });
  const inspector = page.locator('.inspector-subject');
  await expect(inspector).toBeVisible();

  const width = inspector.getByLabel('Largeur (mm)');
  await width.fill('99000');
  await width.press('Enter');
  await expect(page.getByRole('status')).toContainText('Refusé');
  // The model is unchanged: a refused edit changes nothing.
  await expect(inspector).not.toContainText('99.00 m');
});

test('names the project, its site and its calculation settings', async ({
  page,
}) => {
  await page.goto('/');
  await openDestination(page, 'Projet');

  // The name is editable, and it names the exported file.
  const name = page.getByLabel('Nom du projet');
  await name.fill('Maison Dupont');
  await name.press('Enter');
  await expect(page.locator('.shell-status strong')).toHaveText(
    'Maison Dupont',
  );

  // Half a location is refused rather than completed with a zero; the pair is
  // stored once both halves are given.
  const latitude = page.getByLabel('Latitude (°)');
  await latitude.fill('48');
  await latitude.press('Enter');
  await expect(page.getByRole('status')).toContainText('Refusé');
  const longitude = page.getByLabel('Longitude (°)');
  await longitude.fill('-4.1');
  await longitude.press('Enter');
  await expect(page.getByRole('status')).toContainText('Modifier le site');

  // A calculation setting is filled in from the interface, not from JSON.
  await page.getByLabel('Module').selectOption('heating');
  const outdoor = page.getByLabel('Température extérieure de base (°C)');
  await outdoor.fill('-7');
  await outdoor.press('Enter');
  await expect(page.getByRole('status')).toContainText(
    'Modifier un réglage de calcul',
  );

  // The saved project carries all three.
  const download = page.waitForEvent('download');
  await fileAction(page, 'Exporter le JSON');
  const saved = JSON.parse(
    await readFile(await (await download).path(), 'utf8'),
  ) as {
    project: {
      metadata: { name: string };
      site: { location?: { latitudeDeg: number } };
      calculationSettings?: Record<
        string,
        { settings: Record<string, number> }
      >;
    };
  };
  expect(saved.project.metadata.name).toBe('Maison Dupont');
  expect(saved.project.site.location?.latitudeDeg).toBe(48);
  expect(
    saved.project.calculationSettings?.heating?.settings
      .designOutdoorTemperatureC,
  ).toBe(-7);
});

test('chooses the octave bands the acoustic study covers', async ({ page }) => {
  await page.goto('/');
  await openDestination(page, 'Projet');
  await page.getByLabel('Module').selectOption('acoustics');

  const bands = page.getByRole('group', { name: /Bandes étudiées/ });
  await expect(bands).toBeVisible();
  await bands.getByRole('checkbox', { name: '500 Hz' }).check();
  await bands.getByRole('checkbox', { name: '1000 Hz' }).check();
  await expect(page.getByRole('status')).toContainText(
    'Modifier un réglage de calcul',
  );

  const download = page.waitForEvent('download');
  await fileAction(page, 'Exporter le JSON');
  const saved = JSON.parse(
    await readFile(await (await download).path(), 'utf8'),
  ) as {
    project: {
      calculationSettings?: Record<
        string,
        { settings: Record<string, unknown> }
      >;
    };
  };
  // The bands are stored as the list the module reads, in ascending order.
  expect(
    saved.project.calculationSettings?.acoustics?.settings.bandsHz,
  ).toEqual([500, 1000]);

  // Unticking the last band removes the setting instead of storing an empty
  // study: the module then reports the input as missing.
  await bands.getByRole('checkbox', { name: '500 Hz' }).uncheck();
  await bands.getByRole('checkbox', { name: '1000 Hz' }).uncheck();
  const second = page.waitForEvent('download');
  await fileAction(page, 'Exporter le JSON');
  const cleared = JSON.parse(
    await readFile(await (await second).path(), 'utf8'),
  ) as {
    project: {
      calculationSettings?: Record<
        string,
        { settings: Record<string, unknown> }
      >;
    };
  };
  expect(
    cleared.project.calculationSettings?.acoustics?.settings,
  ).not.toHaveProperty('bandsHz');
});

test('associates a climate dataset and reports what it covers', async ({
  page,
}) => {
  await page.goto('/');
  await openDestination(page, 'Projet');
  await expect(page.locator('.notice.warning')).toContainText(
    'Aucun jeu de données climatiques',
  );

  await page.setInputFiles(
    '#climate-file',
    'examples/reference-house/climate-monthly.json',
  );
  await expect(page.getByRole('status')).toContainText('associé au projet');
  const row = page.locator('.library-table tbody tr').first();
  await expect(row).toContainText('référence du projet');
  // Coverage is stated per module, never as one global percentage: this
  // monthly file serves the heating load and cannot drive an hourly battery.
  await expect(row).toContainText('Chauffage — toutes les grandeurs');
  await expect(row).toContainText('Batterie — pas de temps monthly');

  // Removing it takes the reference with it rather than leaving a dangling one.
  await row.getByRole('button', { name: 'Retirer' }).click();
  await expect(page.locator('.notice.warning')).toContainText(
    'Aucun jeu de données climatiques',
  );
});

test('creates a scenario, states what it changes and compares it', async ({
  page,
}) => {
  await loadDemo(page);
  await openDestination(page, 'Scénarios');

  await page.getByLabel('Nouveau scénario').fill('Isolation renforcée');
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Ajouter le scénario');
  await expect(page.locator('h3')).toContainText('Isolation renforcée');
  await expect(page.locator('.library-table tbody tr').first()).toContainText(
    'ne modifie encore rien',
  );

  // The change is chosen by what it means, never by a path into the file.
  const target = page.getByLabel('Valeur modifiée');
  // Named by what the layer is made of, not by the identifier the file uses.
  const insulation = await target
    .locator('option', { hasText: 'épaisseur de Polystyrène expansé PSE' })
    .first()
    .getAttribute('value');
  await target.selectOption(insulation);
  await page.getByLabel(/Nouvelle valeur/).fill('0.3');
  await page.getByRole('button', { name: 'Ajouter le changement' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Ajouter un changement au scénario',
  );
  const change = page.locator('.library-table tbody tr').first();
  await expect(change).toContainText('0.14');
  await expect(change).toContainText('0.3');

  // And the comparison reflects it.
  await page.getByLabel('Scénario comparé').selectOption({ index: 0 });
  await expect(page.locator('.delta').first()).toBeVisible({ timeout: 20_000 });
});

test('promotes a scenario into the project', async ({ page }) => {
  await loadDemo(page);
  await openDestination(page, 'Scénarios');
  await page.getByLabel('Scénario comparé').selectOption({ index: 0 });
  const before = await page
    .locator('.library-table tbody tr')
    .first()
    .textContent();
  await page.getByRole('button', { name: 'Promouvoir en projet' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Promouvoir un scénario en projet',
  );
  // The project now carries what the scenario described, so the change reads
  // as having no effect any more.
  const after = await page
    .locator('.library-table tbody tr')
    .first()
    .textContent();
  expect(after).not.toBe(before);
});

test('gathers what the project does not resolve and offers to fix it', async ({
  page,
}) => {
  await loadDemo(page);
  // Run the modules first: their missing inputs are part of the findings.
  await openDestination(page, 'Calculs');
  await expect(page.locator('.module-header')).toHaveCount(17);

  await openDestination(page, 'Vérifications');
  const findings = page.locator('.alert-list li');
  await expect(findings.first()).toBeVisible();

  // A project with no rule pack says so, and does not claim compliance.
  await expect(page.locator('.library-panel')).toContainText(
    'Aucun référentiel activé',
  );
  await expect(page.locator('.library-panel .notice').last()).toContainText(
    'ne constatent aucune conformité réglementaire',
  );

  // The button says where it leads, and goes there.
  await findings
    .filter({ hasText: 'Aucun référentiel activé' })
    .getByRole('button', { name: 'Ouvrir les référentiels' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Informations, site et réglages' }),
  ).toBeVisible();
});

test('counts the findings at the bottom edge, always', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const status = page.locator('.shell-status');
  const counter = status.getByRole('button', { name: /^Vérifications :/u });
  // Always there, whatever space one is in: findings were read when somebody
  // thought to go and read them.
  await expect(counter).toBeVisible();
  await openDestination(page, 'Quantités');
  await expect(counter).toBeVisible();

  await counter.click();
  const drawer = page.getByRole('dialog', { name: 'Anomalies' });
  await expect(drawer).toBeVisible();
  // It never claims a check passed: every finding it holds is a remark.
  await expect(drawer).toContainText('remarque(s)');

  // And it takes you where the remark is, in one click.
  await drawer.locator('button.link').first().click();
  await expect(drawer).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('suggests what is left without ever standing in the way', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await openDestination(page, 'Projet');
  const guide = page.getByRole('region', { name: 'Progression' });
  await expect(guide).toBeVisible();
  await expect(guide).toContainText('une suggestion, jamais une condition');

  // Les dix phases sont ici et nulle part ailleurs : la barre en compte sept,
  // qui disent de quelle partie de la maison on s'occupe, et non ce qu'il
  // reste à faire.
  const bar = page.getByRole('navigation', { name: 'Étapes de création' });
  await expect(bar.getByRole('button')).toHaveCount(7);
  await expect(guide).toContainText('Architecture');
  await expect(guide).toContainText('Technique');

  // What the house actually holds reads as done; nothing was ticked by hand.
  const architecture = guide.locator('details').filter({ hasText: 'Murs' });
  await architecture.getByText('Architecture').click();
  await expect(architecture.locator('.workflow-done').first()).toBeVisible();

  // A step is a way in, not a gate: clicking one takes you to its stage.
  await architecture
    .getByRole('button', { name: 'Dessiner les murs extérieurs' })
    .click();
  await expect(page.locator('.plan-canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('reads the same plan through one discipline at a time', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const canvas = page.locator('.plan-canvas');
  const walls = page.locator('[data-role="WALL_CUT"][id^="wall:"]');
  await expect(walls).toHaveCount(6);

  await openStage(page, 'Systèmes');
  // Le métier se choisit dans la rangée des sous-parties : dans Systèmes, une
  // sous-partie *est* une discipline, et deux endroits pour une décision sont
  // un endroit de trop.
  const parts = page.getByRole('navigation', { name: 'Sous-parties' });
  const power = parts.getByLabel('Électricité', { exact: true });
  await expect(power).toBeVisible();
  // Le compte fait la différence entre « rien à voir » et « rien de tracé ».
  await expect(power).toHaveAttribute('title', /réseau/u);

  await power.click();
  // The same drawing, under the same walls: Systèmes is a context, not a way
  // out of the model.
  await expect(canvas).toBeVisible();
  await expect(walls).toHaveCount(6);
  await expect(power).toHaveAttribute('aria-current', 'true');
  expect(errors).toEqual([]);
});

test('opens a library from the property that designates a fiche', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  // Changer l'assemblage d'un mur demandait de quitter le plan pour
  // « Matériaux », de trouver la fiche, puis de revenir. Une bibliothèque est
  // un catalogue qu'on consulte, pas un lieu où l'on va.
  const canvas = page.locator('.plan-canvas');
  const at = await page.evaluate(() => {
    const wall = document
      .querySelector('[id="wall:wall-south"]')!
      .getBoundingClientRect();
    const frame = document
      .querySelector('.plan-canvas')!
      .getBoundingClientRect();
    return {
      x: wall.x - frame.x + wall.width / 2,
      y: wall.y - frame.y + wall.height / 2,
    };
  });
  await canvas.click({ position: at });
  // Quel mur exactement n'a pas d'importance : ce qui compte est qu'un mur ait
  // un assemblage, et que le champ qui le désigne sache l'ouvrir.
  const inspector = page.locator('.inspector-subject');
  await expect(inspector).toContainText('Mur');

  const field = inspector.locator('.inspector-edit', {
    hasText: 'Assemblage',
  });
  await field.getByRole('button', { name: 'Bibliothèque…' }).click();
  await expect(page.locator('.assembly-list li').first()).toBeVisible();

  // Et elles restent atteignables sans sélection, rangées avec ce qu'on
  // cherche plutôt qu'en tête du panneau.
  await openDestination(page, 'Plan');
  await openModelTree(page);
  const tree = page.getByRole('navigation', { name: 'Arborescence du projet' });
  await tree.locator('summary').filter({ hasText: 'Bibliothèques' }).click();
  await tree.getByRole('button', { name: 'Matériaux', exact: true }).click();
  await expect(page.locator('.library-table tbody tr').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('shows what the plan shows when nothing is selected', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  // « Sélectionnez un objet du plan » réservait un panneau entier pour une
  // phrase qui n'apprend rien à qui vient de cliquer dans le vide. Un objet a
  // des propriétés ; une vue aussi.
  await openInspector(page);
  const rest = page.locator('.view-properties');
  await expect(rest).toBeVisible();
  await expect(rest).toContainText('Rez-de-chaussée');
  await expect(rest).toContainText('Plan architectural');
  await expect(rest).toContainText('1:');

  // Elles se lisent ici et se changent ailleurs : un même réglage à deux
  // endroits finit par dire deux choses.
  await expect(rest).toContainText('se change dans Affichage');
  await expect(rest.getByRole('button')).toHaveCount(0);

  // Et l'objet reprend la place dès qu'on en désigne un.
  const canvas = page.locator('.plan-canvas');
  const at = await page.evaluate(() => {
    const wall = document
      .querySelector('[id="wall:wall-south"]')!
      .getBoundingClientRect();
    const frame = document
      .querySelector('.plan-canvas')!
      .getBoundingClientRect();
    return {
      x: wall.x - frame.x + wall.width / 2,
      y: wall.y - frame.y + wall.height / 2,
    };
  });
  await canvas.click({ position: at });
  await expect(page.locator('.inspector-subject')).toBeVisible();
  await expect(rest).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('says what the active tool expects, and how to stop', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const bar = page.locator('.context-tool-bar');

  // Un outil disait son nom et rien d'autre : « Mur » ne dit pas s'il faut
  // cliquer une fois ou deux, ni comment on arrête un tracé qui ne s'arrête
  // pas tout seul. On le découvrait en se trompant.
  await chooseTool(page, 'Mur');
  await expect(bar).toContainText('Cliquez le premier point.');
  await expect(bar).not.toContainText('Échap');

  const canvas = page.locator('.plan-canvas');
  const frame = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: 60, y: frame.height - 40 } });
  await expect(bar).toContainText('Cliquez le second point.');
  // Et une issue apparaît dès qu'il y a quelque chose à abandonner.
  await expect(bar).toContainText('Échap');
  await bar.getByRole('button', { name: 'Annuler le tracé' }).click();
  await expect(bar).toContainText('Cliquez le premier point.');

  // Un tracé qui ne s'arrête pas tout seul dit comment on l'arrête.
  await chooseTool(page, 'Mur continu');
  await canvas.click({ position: { x: 60, y: frame.height - 40 } });
  await canvas.click({ position: { x: 200, y: frame.height - 40 } });
  await expect(bar).toContainText('Terminer le tracé : Entrée');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('names an entry by what it places, and pre-fills its fiche', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await openStage(page, 'Systèmes');

  // « WC » n'est pas un vingt-sixième outil : c'est l'outil composant avec la
  // fiche WC déjà désignée. Choisir l'entrée fait les deux d'un coup.
  const toolbox = page.locator('#workspace-sidebar, .tool-header');
  await openSection(page, 'Eau');
  await toolbox.getByRole('button', { name: 'WC', exact: true }).click();
  await expect(page.getByLabel('Catégorie')).toHaveValue('SANITARY');
  await expect(page.getByLabel('Modèle catalogue')).toHaveValue(/generic-wc/u);

  // Et l'entrée voisine change la fiche sans changer d'outil.
  await toolbox.getByRole('button', { name: 'Lavabo', exact: true }).click();
  await expect(page.getByLabel('Modèle catalogue')).toHaveValue(
    /generic-washbasin/u,
  );

  // Et c'est bien un seul outil : la barre au-dessus du dessin nomme
  // l'outil composant, pas une vingt-sixième entrée du registre.
  await expect(page.locator('.context-tool-bar')).toContainText('Composant');

  // Ce que la sous-partie ne propose pas est dans le même sommaire, à un
  // dépliage — les autres sous-parties de **cet** espace, et non celles des
  // six autres : « Mur » appartient au bâtiment.
  const parts = page.getByRole('navigation', { name: 'Sous-parties' });
  await expect(parts.getByLabel('Chauffage', { exact: true })).toHaveCount(1);
  await openSection(page, 'Chauffage');
  await expect(
    toolbox.getByRole('button', { name: 'Mur', exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('reads every trade in the space that draws it, solar included', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const canvas = page.locator('.plan-canvas');

  // Le solaire et le stockage sont des spécialités de Systèmes, comme
  // l'électricité : un onglet Énergie séparé demandait de savoir d'avance
  // qu'un panneau ne se pose pas là où se pose une prise.
  await openStage(page, 'Systèmes');
  const parts = page.getByRole('navigation', { name: 'Sous-parties' });
  await parts.getByLabel('Solaire', { exact: true }).click();
  await expect(canvas).toBeVisible();
  await expect(parts.getByLabel('Électricité', { exact: true })).toHaveCount(1);
  await expect(parts.getByLabel('Stockage', { exact: true })).toHaveCount(1);

  // Et la structure est une sous-partie du bâtiment : ce qui porte les murs se
  // dessine là où les murs se dessinent.
  await openStage(page, 'Bâtiment');
  await expect(parts.getByLabel('Structure', { exact: true })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('chooses what is drawn from a preset before a checkbox', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const panel = page.getByRole('dialog', { name: 'Affichage' });
  await expect(panel).toHaveCount(0);
  await openDisplayPanel(page);

  // Un seul écran pour « ce qui est dessiné » et « comment c'est dessiné » :
  // deux interfaces pour une question sont deux réponses qui divergent.
  await panel
    .getByRole('button', { name: 'Plan technique', exact: true })
    .click();
  await expect(
    panel.getByRole('button', { name: 'Plan technique', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');

  // A preset answers the usual question in one click.
  await panel.getByRole('button', { name: 'Électricité' }).click();
  await expect(
    panel.getByRole('button', { name: 'Électricité' }),
  ).toHaveAttribute('aria-pressed', 'true');
  // And the panel says how much is hidden, so nobody prints a plan missing
  // half its objects without being told.
  await expect(panel).toContainText('masqué(s)');

  // The twenty-eight layers are still there, one disclosure down.
  await panel.getByText(/^Calque par calque/u).click();
  await expect(panel.locator('.layer-list li').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);

  // Et le compte se lit sans ouvrir le panneau : un plan amputé sans rien à
  // l'écran pour le dire est un plan que quelqu'un imprimera.
  await expect(page.getByRole('button', { name: /^Affichage/u })).toContainText(
    /\d/u,
  );
  expect(errors).toEqual([]);
});

test('keeps the building navigator in front, and its lists folded', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const tree = page.getByRole('navigation', { name: 'Arborescence du projet' });
  // « Où je suis » se demande souvent, « qu'est-ce que j'ajoute » se demande
  // tout le temps : l'arborescence est passée sous « Ajouter », derrière un
  // seul dépliage nommé par ce qu'il contient — jamais derrière « ☰ Modèle ».
  await expect(page.getByText('☰ Modèle')).toHaveCount(0);
  await openModelTree(page);
  await expect(tree).toBeVisible();

  // Les niveaux sont là, au-dessus du dépliage : l'étage courant n'est pas un
  // contenu qu'on range, c'est où va ce qu'on trace.
  const levels = page.getByRole('group', { name: 'Niveaux', exact: true });
  await expect(levels.getByRole('button')).toHaveCount(2);
  await levels.getByRole('button', { name: 'Étage' }).click();
  await expect(page.locator('.status-bar')).toContainText('Étage');

  // Ce que l'étage contient se compte plutôt que se dérouler : une famille
  // vide n'est pas une rangée, et les listes s'ouvrent à la demande.
  const walls = tree.locator('summary').filter({ hasText: 'Murs' });
  await expect(walls).toBeVisible();
  await expect(
    tree.locator('summary').filter({ hasText: 'Cotes' }),
  ).toHaveCount(0);
  await walls.click();
  await expect(tree.getByRole('button').first()).toBeVisible();

  // Ce que le projet produit se trouve là où l'on cherche le reste.
  await expect(
    tree.locator('summary').filter({ hasText: 'Vues et feuilles' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('sends the tail of a long family to the search, by a button', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await openModelTree(page);
  const tree = page.getByRole('navigation', { name: 'Arborescence du projet' });
  // `Ctrl+K` était la seule issue au-delà de quarante objets, écrite dans une
  // phrase : elle supposait qu'on connaisse le raccourci, qu'on ait un clavier
  // et qu'on ait lu la ligne. C'est un bouton, et il sait ce qu'on cherche.
  await tree.locator('summary').filter({ hasText: 'Composants' }).click();
  await expect(tree.getByText(/Ctrl\+K/u)).toHaveCount(0);

  // Vingt-trois composants : sous le seuil, donc pas de bouton ici. Le
  // raccourci reste un accélérateur, jamais le seul chemin.
  await page.getByRole('button', { name: 'Rechercher' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Palette de commandes' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('takes seven steps to show what a finding is about', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const canvas = page.locator('.plan-canvas');
  const frame = (await canvas.boundingBox())!;
  const stair = (await page
    .locator('[id="stair:stair-ground-first"]')
    .boundingBox())!;
  // A quarter of the way down the flight: the partitions cross its bounding
  // box at the middle, and a click there takes the wall.
  await canvas.click({
    position: {
      x: stair.x - frame.x + stair.width / 2,
      y: stair.y - frame.y + stair.height * 0.15,
    },
  });
  const inspector = page.locator('.inspector-subject');
  await expect(inspector).toContainText('stair-ground-first');

  // Treads too deep for the line they are drawn along: the plan now shows one
  // stair and the dimensions state another.
  const tread = inspector.getByLabel('Giron');
  await tread.fill('420');
  await tread.press('Enter');
  await expect(page.getByRole('status')).toContainText('escalier');

  await openDestination(page, 'Vérifications');
  const findings = page.locator('.alert-list li');
  const broken = findings.filter({ hasText: 'ne porte pas ses marches' });
  await expect(broken.first()).toBeVisible();

  // « Voir sur le plan » has to do all of it: open the right storey, restore
  // the layer, select the object, frame it, open the inspector and expand the
  // property the finding named. A workspace is not an answer; a field is.
  await broken
    .first()
    .getByRole('button', { name: 'Voir sur le plan' })
    .click();
  await expect(canvas).toBeVisible();
  await expect(inspector).toContainText('stair-ground-first');
  // Both the stated value and the field that changes it are marked: they are
  // the same property, read and written.
  const targeted = inspector.locator('.targeted');
  await expect(targeted.first()).toBeVisible();
  for (const text of await targeted.allTextContents())
    expect(text).toContain('Giron');
  await expect(inspector.locator('.inspector-edit.targeted')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('folds the bookkeeping away and keeps the object open', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const canvas = page.locator('.plan-canvas');
  const box = (await canvas.boundingBox())!;
  const east = (await page.locator('[id="wall:wall-east"]').boundingBox())!;
  await canvas.click({
    position: {
      x: east.x - box.x + east.width / 2,
      y: east.y - box.y + east.height * 0.25,
    },
  });
  const inspector = page.locator('.inspector-subject');
  await expect(inspector).toContainText('wall-east');

  // What the wall is stays open; where it lives in the file is one disclosure
  // away — identifiers are needed about once a month and took the top of the
  // panel every second of the other days.
  const references = inspector.locator('details');
  await expect(references).toHaveCount(1);
  await expect(references).not.toHaveAttribute('open', '');
  await expect(inspector.getByText('Identifiant')).toBeHidden();
  await references.getByText('Références').click();
  await expect(inspector.getByText('Identifiant')).toBeVisible();
  expect(errors).toEqual([]);
});

test('puts what the house needs beside what is standing in it', async ({
  page,
}) => {
  // The heating load and the count of heat generators were both computed and
  // never compared. What was missing was not a number, it was the sentence.
  await loadDemo(page);
  await openDestination(page, 'Calculs');
  await expect(page.locator('.module-header')).toHaveCount(17);

  await openDestination(page, 'Vérifications');
  const findings = page.locator('.alert-list li');
  await expect(findings.first()).toBeVisible();
  // The reference house is heated — a heat pump, five radiators and two towel
  // rails — and the landing is the one room nothing emits into. That is the
  // comparison this panel exists to make, and it names the room and the two
  // figures rather than saying « non conforme ».
  const landing = findings.filter({ hasText: 'Palier' });
  await expect(landing).toHaveCount(1);
  await expect(landing).toContainText('W');
  // Nothing is said about the rooms that are heated, and nothing about the
  // ventilation unit, which holds what its extract terminals ask.
  await expect(findings.filter({ hasText: 'Chambre 1' })).toHaveCount(0);
  await expect(
    findings.filter({ hasText: 'ne tient pas les bouches' }),
  ).toHaveCount(0);
  // Nothing here claims compliance; that is a rule pack's business.
  await expect(page.locator('.library-panel')).not.toContainText(
    'est conforme',
  );
});

test('offers only reference sides the model accepts', async ({ page }) => {
  await loadDemo(page);
  const canvas = page.locator('.plan-canvas');
  const box = (await canvas.boundingBox())!;
  const east = (await page.locator('[id="wall:wall-east"]').boundingBox())!;
  await canvas.click({
    position: {
      x: east.x - box.x + east.width / 2,
      y: east.y - box.y + east.height * 0.25,
    },
  });

  // The domain knows CENTER, LEFT and RIGHT. A menu offering anything else
  // would write a value the renderer cannot draw.
  const side = page
    .locator('.inspector-subject')
    .getByLabel('Face de référence');
  const values = await side
    .locator('option')
    .evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value),
    );
  expect(values).toEqual(['CENTER', 'LEFT', 'RIGHT']);

  const errors = watchConsole(page);
  await side.selectOption('LEFT');
  await expect(page.getByRole('status')).toContainText('Modifier un mur');
  // The plan still draws: the value reached the model intact.
  await expect(page.locator('[data-role="WALL_CUT"][id^="wall:"]')).toHaveCount(
    6,
  );
  expect(errors).toEqual([]);
});

test('restores a local snapshot without claiming it was exported', async ({
  page,
}) => {
  await loadDemo(page);
  await chooseTool(page, 'Mur');
  const canvas = page.locator('.plan-canvas');
  await canvas.click({ position: { x: 120, y: 380 } });
  await canvas.click({ position: { x: 420, y: 380 } });
  await expect(page.locator('.save-state')).toContainText(
    'Sauvegardé localement',
    { timeout: 10_000 },
  );

  await page.reload();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Restaurer' })
    .click();
  // The snapshot is not a file: the chip must not read "Enregistré".
  await expect(page.locator('.save-state')).toContainText(
    'Sauvegardé localement',
  );
});

test('activates a rule pack and reports what it checked', async ({ page }) => {
  await loadDemo(page);
  await openDestination(page, 'Vérifications');
  await expect(page.locator('.library-panel')).toContainText(
    'Aucun référentiel activé',
  );

  await openDestination(page, 'Projet');
  await page.getByRole('checkbox', { name: /fr-rainwater-example/ }).check();
  await expect(page.getByRole('status')).toContainText(
    'Modifier les référentiels activés',
  );

  // The demonstration project states a country but no reference date, and the
  // date decides which text applies: the pack is not run, and says why.
  await openDestination(page, 'Vérifications');
  await expect(page.locator('.library-panel')).toContainText(
    'date de référence',
  );
  await expect(page.locator('.rule-panel')).toHaveCount(0);

  await openDestination(page, 'Projet');
  // Targeted by id: the pack list explains applicability in words that repeat
  // the field labels, so a label lookup would match two controls.
  await page.locator('#regulatory-date').fill('2020-01-01');
  await page.locator('#regulatory-date').press('Enter');
  // Before the text came into force: still no verdict, and the reason is the
  // date rather than the project.
  await openDestination(page, 'Vérifications');
  await expect(page.locator('.library-panel')).toContainText('2020-01-01');
  await expect(page.locator('.rule-panel')).toHaveCount(0);

  await openDestination(page, 'Projet');
  await page.locator('#regulatory-country').fill('BE');
  await page.locator('#regulatory-country').press('Enter');
  await page.locator('#regulatory-date').fill('2026-01-01');
  await page.locator('#regulatory-date').press('Enter');
  await openDestination(page, 'Vérifications');
  await expect(page.locator('.library-panel')).toContainText('BE');
  await expect(page.locator('.rule-panel')).toHaveCount(0);

  await openDestination(page, 'Projet');
  await page.locator('#regulatory-country').fill('FR');
  await page.locator('#regulatory-country').press('Enter');

  await openDestination(page, 'Vérifications');
  const report = page.locator('.rule-panel');
  await expect(report).toBeVisible();
  await expect(report).toContainText('fr-rainwater-example');
  // The demonstration project harvests no rainwater, so the rule does not
  // apply — which is not the same answer as "conforme".
  await expect(report.locator('.rule-card')).toHaveCount(1);
  await expect(report.locator('.rule-card')).toContainText('Non applicable');

  // Two rainwater systems, judged one by one rather than through the first.
  for (const system of ['ROOF_DRAINAGE', 'HARVESTING']) {
    await openDestination(page, 'Réseaux');
    await page
      .getByLabel('Discipline', { exact: true })
      .selectOption('RAINWATER');
    await page.getByLabel('Système', { exact: true }).selectOption(system);
    await page.getByRole('button', { name: 'Créer le réseau' }).click();
    await expect(
      page.locator('.library-table tbody tr', { hasText: system }),
    ).toHaveCount(1);
  }

  await openDestination(page, 'Vérifications');
  await expect(report.locator('.rule-card')).toHaveCount(2);
  const cards = report.locator('.rule-card');
  await expect(cards.first()).toContainText('Objets :');
  await expect(
    cards.first().getByRole('button', { name: 'Localiser' }),
  ).toBeVisible();
  await expect(page.locator('.library-panel')).not.toContainText(
    'Aucun référentiel activé',
  );
});

test('never shows calculation results from an earlier revision', async ({
  page,
}) => {
  await loadDemo(page);
  await openDestination(page, 'Calculs');
  await expect(page.locator('.dashboard-card').first()).toBeVisible();
  const computedOn = await page
    .locator('.library-panel .hint')
    .first()
    .textContent();
  expect(computedOn).toContain('révision');

  // Edit the model after the results were produced.
  await openDestination(page, 'Plan');
  await chooseTool(page, 'Mur');
  const canvas = page.locator('.plan-canvas');
  await canvas.click({ position: { x: 120, y: 380 } });
  await canvas.click({ position: { x: 420, y: 380 } });

  await openDestination(page, 'Projet');
  const revision =
    (await page.locator('#project-revision').textContent()) ?? '';
  const current = /^(\d+)/u.exec(revision.trim())?.[1];
  expect(current).toBeDefined();

  await openDestination(page, 'Vérifications');
  // The panel recomputes rather than presenting the numbers of the house as it
  // was before the wall was drawn.
  await expect(
    page.locator('.library-panel', { hasText: 'Constats de calcul établis' }),
  ).toContainText(`révision ${current!}`, { timeout: 20_000 });
});

test('chooses a scenario reference among the objects the project holds', async ({
  page,
}) => {
  await loadDemo(page);
  await openDestination(page, 'Scénarios');
  await page.getByLabel('Nouveau scénario').fill('Autre assemblage');
  await page.getByRole('button', { name: 'Créer', exact: true }).click();

  const targets = page.getByLabel('Valeur modifiée');
  const assemblyTarget = await targets
    .locator('option', { hasText: 'Assemblage du mur' })
    .first()
    .getAttribute('value');
  expect(assemblyTarget).toMatch(
    /^building\/levels\/[^/]+\/walls\/[^/]+\/assemblyId$/u,
  );
  await targets.selectOption(assemblyTarget);

  // A reference is picked from a menu: a scenario cannot name an assembly the
  // project does not declare.
  const value = page.locator('select#scenario-value');
  await expect(value).toBeVisible();
  const options = await value.locator('option').allTextContents();
  expect(options.length).toBeGreaterThan(1);
  await value.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Ajouter le changement' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Ajouter un changement au scénario',
  );
  // The change addresses the wall by name, not by its position in the file.
  await expect(
    page.getByRole('table', { name: 'Modifications déclarées par' }),
  ).toContainText('Assemblage du mur');
});

test('keeps a scenario selected after deleting another one', async ({
  page,
}) => {
  await loadDemo(page);
  await openDestination(page, 'Scénarios');
  await page.getByLabel('Nouveau scénario').fill('Variante B');
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  const compared = page.getByLabel('Scénario comparé');
  const before = await compared.locator('option').count();
  expect(before).toBeGreaterThan(1);

  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(compared.locator('option')).toHaveCount(before - 1);
  // A scenario is still selected, and the comparison it drives is the one shown.
  const selected = await compared.inputValue();
  expect(selected).not.toBe('');
  await expect(page.locator('h3')).toContainText('Modifications de');
});

test('takes the price of a product by the metre and of a model by the unit', async ({
  page,
}) => {
  // A house's whole plumbing, wiring and equipment had prices the interface
  // could not take: the screen knew one table, and it was per cubic metre.
  await loadDemo(page);
  await openDestination(page, 'Projet');
  await page.getByLabel('Module', { exact: true }).selectOption('cost');
  await expect(
    page.getByRole('columnheader', { name: 'Produit réseau' }),
  ).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: 'Modèle d’équipement' }),
  ).toBeVisible();
  // And a line per product the project actually names.
  const field = page.getByLabel('Prix du produit — Câble cuivre 3G1,5');
  await expect(field).toBeVisible();
  await field.fill('1.4');
  await field.blur();
  await expect(page.getByRole('status')).toContainText('appliqué');
});

test('never offers to fix a value the settings screen cannot take', async ({
  page,
}) => {
  await page.goto('/');
  await openDestination(page, 'Calculs');
  await expect(page.locator('.module-header')).toHaveCount(17);
  await openDestination(page, 'Vérifications');

  const findings = page.locator('.alert-list li');
  await expect(findings.first()).toBeVisible();
  // The occupancy map is one of the inputs the dashboard reports missing; the
  // settings screen has to be able to take it for the button to be offered.
  const occupancy = findings.filter({ hasText: 'occupantsByCategory' });
  if ((await occupancy.count()) > 0) {
    await occupancy
      .first()
      .getByRole('button', { name: 'Ouvrir les réglages de calcul' })
      .click();
    await page.getByLabel('Module').selectOption('iaq');
    await expect(page.getByLabel('Séjour')).toBeVisible();
  }

  // Whatever the findings are, each one that offers a way out says where it
  // leads rather than saying « Corriger » about five different spaces.
  const fixable = await findings.locator('button.link').count();
  expect(fixable).toBeGreaterThan(0);
});

test('an emptied equipment field is gone after a save and a reload', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await openDestination(page, 'Équipements');
  await page
    // The list names a thing by its name once the fiche gives it one, and
    // falls back to the identifier only when nothing does.
    .getByRole('button', { name: 'Ballon d’eau chaude sanitaire', exact: true })
    .click();

  const loss = page.getByLabel('Pertes à l’arrêt');
  await expect(loss).toHaveValue('45');
  await loss.fill('');
  await loss.press('Enter');
  // The property is removed, not stored as zero and not as NaN: nobody chose a
  // value, so the project stops claiming one.
  await expect(page.getByLabel('Pertes à l’arrêt')).toHaveCount(0);

  const download = page.waitForEvent('download');
  await fileAction(page, 'Sauvegarder');
  const saved = await (await download).path();
  expect(saved).not.toBeNull();

  await page.reload();
  await expect(page.getByRole('status')).toContainText('Nouveau projet');
  // Exporting clears the local snapshot, so the restore prompt may not appear
  // at all; when it does, the exported file is the one being reloaded.
  const prompt = page.getByRole('alertdialog');
  if ((await prompt.count()) > 0)
    await prompt.getByRole('button', { name: 'Ignorer et supprimer' }).click();
  await page.setInputFiles('input[type="file"]', saved);
  await expect(page.getByRole('status')).toContainText('chargé et validé');
  await openDestination(page, 'Équipements');
  await page
    // The list names a thing by its name once the fiche gives it one, and
    // falls back to the identifier only when nothing does.
    .getByRole('button', { name: 'Ballon d’eau chaude sanitaire', exact: true })
    .click();
  await expect(page.getByLabel('Volume de ballon')).toHaveValue('200');
  await expect(page.getByLabel('Pertes à l’arrêt')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('acts on an object from a menu opened where the object is', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  // La mise en page se fige avant qu'on relève une position dans le plan.
  await openInspector(page);
  await hidePlacedComponents(page);
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const south = (await page.locator('[id="wall:wall-south"]').boundingBox())!;
  const at = {
    x: south.x - box.x + south.width * 0.25,
    y: south.y - box.y + south.height / 2,
  };

  await canvas.click({ button: 'right', position: at });
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  // The object is selected by the same gesture that opened its menu.
  await expect(page.locator('.inspector-subject h3')).toContainText(
    'wall-south',
  );

  // What every object offers, and what a wall alone offers.
  await expect(
    menu.getByRole('menuitem', { name: 'Sélectionner les objets semblables' }),
  ).toBeEnabled();
  await expect(
    menu.getByRole('menuitem', { name: /Face de référence/ }),
  ).toBeDisabled();
  // A wall moves, turns, reflects and is copied: its family says so, and the
  // menu offers exactly what the family says.
  for (const action of ['Dupliquer', 'Pivoter d’un quart de tour', 'Retourner'])
    await expect(menu.getByRole('menuitem', { name: action })).toBeEnabled();

  // The openings this wall carries: the reason the domain refuses to delete
  // it, named rather than left for the user to find by eye.
  await menu
    .getByRole('menuitem', { name: /Sélectionner : ouvertures/ })
    .click();
  await expect(menu).toBeHidden();
  await expect(page.getByRole('status')).toContainText('lié');

  // The walls built the same way and playing the same part: the four of the
  // shell, and neither partition.
  await canvas.click({ button: 'right', position: at });
  await page
    .getByRole('menuitem', { name: 'Sélectionner les objets semblables' })
    .click();
  await expect(page.locator('.selection-list li')).toHaveCount(4);

  // Escape closes the menu without doing anything.
  await canvas.click({ button: 'right', position: at });
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  expect(errors).toEqual([]);
});

test('offers the objects stacked under one point, one after the other', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  // La mise en page se fige avant qu'on relève une position dans le plan.
  await openInspector(page);
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  // A partition, the two rooms it separates and the slab under all of them
  // meet at this point: four objects and one pixel. A point away from the
  // middle of the wall, where its own handles would take the click first.
  const wall = (await page
    .locator('[id="wall:wall-partition-h"]')
    .boundingBox())!;
  const stacked = {
    x: wall.x - box.x + wall.width * 0.25,
    y: wall.y - box.y + wall.height / 2,
  };

  const title = page.locator('.inspector-subject h3');
  const seen: string[] = [];
  // Click until the first one comes round again: what is stacked under a point
  // depends on the house, and the rule under test is the cycling, not the
  // number.
  for (let click = 0; click < 12; click += 1) {
    await canvas.click({ position: stacked });
    await expect(title).toBeVisible();
    const shown = (await title.textContent()) ?? '';
    if (click > 0 && shown === seen[0]) break;
    seen.push(shown);
  }
  // Each click offers the next one rather than the same one for ever, and the
  // wall whose middle was avoided is the first.
  expect(seen[0]).toContain('wall-partition-h');
  expect(seen.length).toBeGreaterThan(3);
  expect(new Set(seen).size).toBe(seen.length);
  // And round again, so nothing under the pointer is out of reach.
  await expect(title).toHaveText(seen[0] ?? '');
  expect(errors).toEqual([]);
});

test('restricts what a click may take to one family', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  // La mise en page se fige avant qu'on relève une position dans le plan.
  await openInspector(page);
  const canvas = page.locator('.plan-canvas');
  const filter = page.getByLabel('Filtrer sur');
  await expect(filter).toHaveValue('ALL');
  await filter.selectOption('SPACE');

  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const south = (await page.locator('[id="wall:wall-south"]').boundingBox())!;
  const onTheWall = {
    x: south.x - box.x + south.width * 0.25,
    y: south.y - box.y + south.height / 2,
  };
  await canvas.click({ position: onTheWall });
  // A room lies under that wall; asked for rooms, the click takes the room.
  const title = page.locator('.inspector-subject h3');
  await expect(title).toBeVisible();
  await expect(title).not.toContainText('Mur');

  // Asked for walls, the same point answers with the wall.
  await filter.selectOption('WALL');
  await canvas.click({ position: onTheWall });
  await expect(title).toContainText('wall-south');
  expect(errors).toEqual([]);
});

test('draws a run of walls corner by corner and encloses by two corners', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  const walls = page.locator('[data-role="WALL_CUT"][id^="wall:"]');
  await expect(walls).toHaveCount(6);

  await chooseTool(page, 'Mur continu');
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  await canvas.click({ position: { x: 60, y: 60 } });
  await canvas.click({ position: { x: 200, y: 60 } });
  await canvas.click({ position: { x: 200, y: 160 } });
  // A run has no number of corners known in advance: the user says when it
  // ends, and the plan says so while it lasts.
  await expect(page.locator('.canvas-status')).toContainText('Entrée termine');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('2 murs');
  await expect(walls).toHaveCount(8);

  // One run, one undo.
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(walls).toHaveCount(6);

  await chooseTool(page, 'Murs rectangle');
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: 60, y: box.height - 140 } });
  await canvas.click({ position: { x: 220, y: box.height - 40 } });
  await expect(walls).toHaveCount(10);
  expect(errors).toEqual([]);
});

test('makes a room out of the contour the walls already enclose', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await chooseTool(page, 'Pièce');
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;

  // Every contour of the reference house already carries a room, and creating
  // a second one over the first would leave two nothing distinguishes.
  await canvas.click({
    position: { x: box.width * 0.3, y: box.height * 0.35 },
  });
  await expect(page.getByRole('status')).toContainText('porte déjà');

  // Outside every contour, the tool says what is missing rather than nothing.
  await canvas.click({ position: { x: 4, y: 4 } });
  await expect(page.getByRole('status')).toContainText('contour');
  expect(errors).toEqual([]);
});

test('places a thing in the building, as an object of the editor', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await chooseTool(page, 'Composant');
  // Un appareil de chauffage appartient aux Systèmes : c'est de là qu'il se
  // pose, et l'onglet où vit l'outil — Aménagement — le refuserait.
  await openStage(page, 'Systèmes');
  await page.getByLabel('Catégorie').selectOption('HEATING');
  // A name the reference house does not already hold: the tree lists what is
  // in the project, and two lines reading the same thing prove nothing about
  // which one was clicked.
  await page.getByLabel('Nom').fill('Radiateur d’essai');

  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await canvas.click({
    position: { x: box.width * 0.3, y: box.height * 0.35 },
  });
  await expect(page.getByRole('status')).toContainText('composant');

  // The placed object is an object of the editor like any other: selectable,
  // described, and tied to the room it stands in.
  await chooseTool(page, 'Sélection');
  await canvas.click({
    position: { x: box.width * 0.3, y: box.height * 0.35 },
  });
  const title = page.locator('.inspector-subject h3');
  await expect(title).toContainText('Radiateur d’essai');
  // What the catalogue knows stays with the catalogue.
  await expect(page.locator('.inspector-subject')).toContainText(
    'ne renvoie à aucun modèle',
  );
  await expect(
    page.getByRole('spinbutton', { name: 'Orientation (°)' }),
  ).toHaveValue('0');
  expect(errors).toEqual([]);
});

test('routes a run of pipe from port to port on the plan', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await chooseTool(page, 'Tracer un tronçon');
  // Choosing a network reveals the layer it draws on; drawing on a hidden
  // layer would place a run the user cannot see.
  const network = page.getByRole('combobox', { name: 'Réseau', exact: true });
  await expect(network).toBeVisible();
  const ports = page.locator('[id^="network-port:water:"]');
  await expect(ports.first()).toBeVisible();

  // Waste water falls by default and pressurised water does not: the tool
  // reads the discipline of the network chosen just beside.
  await expect(page.getByRole('spinbutton', { name: 'Pente (%)' })).toHaveValue(
    '0',
  );
  await network.selectOption({ index: 1 });
  await expect(page.getByRole('spinbutton', { name: 'Pente (%)' })).toHaveValue(
    '2',
  );
  expect(errors).toEqual([]);
});

test('shows a network as a system browser in the project tree', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await openModelTree(page);
  const tree = page.getByRole('navigation', {
    name: 'Arborescence du projet',
  });
  await tree.getByRole('group').filter({ hasText: 'Systèmes' }).click();
  const water = tree.locator('summary', { hasText: 'water' }).first();
  await expect(water).toContainText('tronçons');
  await water.click();
  // A segment is reachable from the tree, like a wall or a room.
  await tree
    .getByRole('button', { name: /water:trunk/ })
    .first()
    .click();
  await expect(page.locator('.inspector-subject h3')).toContainText(
    'water:trunk',
  );
  // The fall a run actually has is read beside its length.
  await expect(page.locator('.inspector-subject')).toContainText('horizontal');
  expect(errors).toEqual([]);
});

test('colours the networks with what their own engines computed', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await chooseOverlay(page, 'none');
  const overlay = page.getByLabel('Superposition');
  // The engines have been in the repository for a long time; until now only
  // the thermal figures reached the drawing.
  await expect(
    overlay.locator('option', { hasText: 'Eau · vitesse' }),
  ).toHaveCount(1);
  await overlay.selectOption('wastewater-slope');

  const legend = page.locator('.overlay-legend');
  await expect(legend).toBeVisible({ timeout: 15_000 });
  await expect(legend).toContainText('Pente des collecteurs');

  // A pipe is a line, and a line is coloured like a wall is.
  await expect(
    page.locator('[id^="overlay:wastewater-slope:"]'),
  ).not.toHaveCount(0);
  expect(errors).toEqual([]);
});

test('colours a room by what it needs, gets and breathes', async ({ page }) => {
  // The heating load of a room, its illuminance and its CO₂ were all computed
  // and only ever read in a table.
  const errors = watchConsole(page);
  await loadDemo(page);
  await chooseOverlay(page, 'none');
  const overlay = page.getByLabel('Superposition');
  const legend = page.locator('.overlay-legend');
  for (const [id, title] of [
    ['heating-room-power', 'Puissance de chauffage par pièce'],
    ['lighting-illuminance', 'Éclairement moyen'],
    ['iaq-co2', 'Concentration maximale en CO₂'],
  ] as const) {
    await overlay.selectOption(id);
    await expect(legend).toBeVisible({ timeout: 15_000 });
    await expect(legend).toContainText(title);
    // A room is a surface, and a surface is coloured like a wall is.
    await expect(page.locator(`[id^="overlay:${id}:"]`)).not.toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('keeps a view, lays it on a sheet and draws the sheet', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await openDestination(page, 'Vues et feuilles');
  await expect(
    page.getByRole('heading', { name: 'Vues et feuilles' }),
  ).toBeVisible();

  await page.getByLabel('Nom de la vue').fill('Plan RDC');
  await page.getByRole('button', { name: 'Enregistrer cette vue' }).click();
  await expect(page.getByRole('status')).toContainText('enregistrée');

  await page.getByLabel('Titre de la feuille').fill('Plan du rez-de-chaussée');
  await page.getByLabel('Format de la nouvelle feuille').selectOption('A3');
  await page.getByRole('button', { name: 'Ajouter une feuille' }).click();
  // The reference house already carries a drawing set, so the sheet this test
  // adds follows it rather than being the first.
  await expect(
    page.getByRole('cell', { name: 'A-002', exact: true }),
  ).toBeVisible();

  // The sheet is drawn from the model, not from a picture kept aside.
  await page
    .getByRole('row')
    .filter({ hasText: 'A-002' })
    .getByRole('button', { name: 'Aperçu' })
    .click();
  const preview = page.locator('.sheet-preview svg').first();
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute('data-sheet-id', /sheet-/);
  // The title block says what the project says, and marks what it cannot say.
  await expect(page.locator('.sheet-preview')).toContainText('A-002');
  await expect(page.locator('.sheet-preview')).toContainText('inconnu');

  // A view a sheet still lays out cannot be taken away. A new sheet lays out
  // the first view of the set, which in the reference house is its own plan of
  // the ground floor.
  const views = page.getByRole('region', { name: 'Vues enregistrées' });
  await views
    .getByRole('row')
    .filter({ hasText: 'Plan du rez-de-chaussée' })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await expect(page.getByRole('status')).toContainText('A-002');
  expect(errors).toEqual([]);
});

test('keeps a section, a façade, a roof plan and a site plan', async ({
  page,
}) => {
  // The drawing set held four kinds of view the application could not draw:
  // opening one gave a plan of a storey wearing the section's name.
  const errors = watchConsole(page);
  await loadDemo(page);
  await openDestination(page, 'Vues et feuilles');

  for (const [kind, name] of [
    ['Coupe', 'Coupe BB'],
    ['Façade', 'Façade nord'],
    ['Plan de toiture', 'Toiture BB'],
    ['Plan de masse', 'Masse BB'],
  ] as const) {
    await page.getByLabel('Type de vue').selectOption({ label: kind });
    await page.getByLabel('Nom de la vue').fill(name);
    await page.getByRole('button', { name: 'Enregistrer cette vue' }).click();
    await expect(page.getByRole('status')).toContainText(name);
  }

  const views = page.getByRole('region', { name: 'Vues enregistrées' });
  for (const [name, type] of [
    ['Coupe BB', 'SECTION'],
    ['Façade nord', 'ELEVATION'],
    ['Toiture BB', 'ROOF'],
    ['Masse BB', 'SITE'],
  ] as const)
    await expect(
      views.getByRole('row').filter({ hasText: name }).getByRole('cell', {
        name: type,
      }),
    ).toBeVisible();

  // Opening a section shows the section, drawn from the model.
  await views
    .getByRole('row')
    .filter({ hasText: 'Coupe BB' })
    .getByRole('button', { name: 'Ouvrir' })
    .click();
  const drawing = page.locator('.sheet-preview svg').first();
  await expect(drawing).toBeVisible();
  // A section stands on its storey: it carries the cut walls a plan has not.
  await expect(drawing.locator('[data-role="WALL_CUT"]').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('lays two views at two scales on one sheet', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await openDestination(page, 'Vues et feuilles');

  // Two views to lay out: a sheet carrying a plan and its neighbour is the
  // ordinary case of a drawing set, and it could not be expressed at all.
  for (const name of ['Plan RDC', 'Plan masse']) {
    await page.getByLabel('Nom de la vue').fill(name);
    await page.getByRole('button', { name: 'Enregistrer cette vue' }).click();
    await expect(page.getByRole('status')).toContainText('enregistrée');
  }

  await page.getByLabel('Titre de la feuille').fill('Dossier');
  await page.getByLabel('Format de la nouvelle feuille').selectOption('A3');
  await page
    .getByLabel('Orientation de la nouvelle feuille')
    .selectOption('PORTRAIT');
  await page.getByRole('button', { name: 'Ajouter une feuille' }).click();

  const row = page.getByRole('row').filter({ hasText: 'A-002' });
  await row.getByRole('button', { name: 'Ajouter une vue' }).click();
  await row
    .getByRole('combobox', { name: 'Vue 2 de la feuille A-002' })
    .selectOption({ label: 'Plan masse' });
  await row
    .getByRole('spinbutton', {
      name: 'Échelle de la vue 2 de la feuille A-002',
    })
    .fill('200');
  await row
    .getByRole('textbox', { name: 'Indice de la feuille A-002' })
    .fill('B');

  // Two frames on the paper, and the title block carries the revision.
  await row.getByRole('button', { name: 'Aperçu' }).click();
  const preview = page.locator('.sheet-preview');
  await expect(preview.locator('svg').first()).toBeVisible();
  await expect(preview.locator('[data-viewport-id]')).toHaveCount(2);
  await expect(preview).toContainText('B');

  // Turning the paper relays the frames rather than leaving them off it.
  await row
    .getByRole('combobox', { name: 'Orientation de la feuille A-002' })
    .selectOption('LANDSCAPE');
  await row.getByRole('button', { name: 'Aperçu' }).click();
  await expect(preview.locator('[data-viewport-id]')).toHaveCount(2);

  // What the export will really be worth, said before it is asked for.
  await expect(page.getByText(/tramé à \d+ ppp/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('reopens a saved view exactly as it was saved', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);

  await openLayerEditor(page);
  // A view saved with a family of objects hidden.
  const stairs = page.getByRole('checkbox', { name: 'Escaliers' });
  await expect(stairs).toBeChecked();
  await stairs.uncheck();
  await closeDisplayPanel(page);
  await openDestination(page, 'Vues et feuilles');
  await page.getByLabel('Nom de la vue').fill('Sans les escaliers');
  await page.getByRole('button', { name: 'Enregistrer cette vue' }).click();
  await expect(page.getByRole('status')).toContainText('enregistrée');

  // The layer turned back on, and the view reopened. Restoring used to turn
  // layers on and never off, so the view came back showing what it had been
  // saved without.
  await openDestination(page, 'Plan');
  await openLayerEditor(page);
  await stairs.check();
  await expect(stairs).toBeChecked();
  await closeDisplayPanel(page);
  await openDestination(page, 'Vues et feuilles');
  await page
    .getByRole('row')
    .filter({ hasText: 'Sans les escaliers' })
    .getByRole('button', { name: 'Ouvrir' })
    .click();
  await expect(page.getByRole('status')).toContainText('rétablie');
  await openDestination(page, 'Plan');
  await openLayerEditor(page);
  await expect(stairs).not.toBeChecked();
  expect(errors).toEqual([]);
});

test('builds a variant by pointing at the plan', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);

  // A variant to build.
  await openDestination(page, 'Scénarios');
  await page.getByLabel('Nouveau scénario').fill('Isolation renforcée');
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  await openDestination(page, 'Plan');

  // The variant is a mode of the plan, chosen above the drawing.
  await page.getByLabel('Variante').selectOption({ index: 1 });
  const mode = page.getByRole('region', { name: 'Scénario', exact: true });
  await expect(mode).toContainText('ne change pas le projet');

  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const south = (await page.locator('[id="wall:wall-south"]').boundingBox())!;
  await canvas.click({
    position: {
      x: south.x - box.x + south.width * 0.25,
      y: south.y - box.y + south.height / 2,
    },
  });
  await expect(page.locator('.inspector-subject h3')).toContainText(
    'wall-south',
  );

  // Changing a property states what the variant does differently.
  await page.getByLabel('Assemblage').selectOption('generic-partition-stud');
  await expect(page.getByRole('status')).toContainText('Scénario');

  // And the drawing says which objects it changed.
  await expect(page.locator('.overlay-legend')).toContainText(
    'Ce que la variante change',
  );

  // Every property the inspector offers can vary, not the four that used to
  // be written down: the reference face is one of them.
  await page.getByLabel('Face de référence').selectOption('LEFT');
  await expect(page.getByRole('status')).toContainText('Face de référence');

  // A property the file does not store cannot: the length of a wall is read
  // off its two points, and a variant setting it would write nothing.
  await page.getByRole('spinbutton', { name: 'Longueur' }).fill('7000');
  await page.getByRole('spinbutton', { name: 'Longueur' }).blur();
  await expect(page.getByRole('status')).toContainText('ne peut pas encore');
  expect(errors).toEqual([]);
});

test('draws the ground the house sits on and its structure', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);

  // The site has held a parcel since the beginning and no screen could draw
  // one.
  await chooseTool(page, 'Parcelle');
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: 20, y: 20 } });
  await canvas.click({ position: { x: box.width - 20, y: 20 } });
  await canvas.click({
    position: { x: box.width - 20, y: box.height - 20 },
  });
  await page.keyboard.press('Enter');
  await expect(page.locator('[id="site:parcel"]')).toHaveCount(1);

  // A column stands where it was put, and the plan shows its section.
  await chooseTool(page, 'Poteau');
  await page.getByLabel('Élément').selectOption('COLUMN');
  const after = (await canvas.boundingBox())!;
  await canvas.click({
    position: { x: after.width * 0.4, y: after.height * 0.4 },
  });
  await expect(page.locator('[id^="structure:member-"]')).toHaveCount(1);

  await chooseTool(page, 'Sélection');
  const selecting = (await canvas.boundingBox())!;
  const column = (await page
    .locator('[id^="structure:member-"]')
    .first()
    .boundingBox())!;
  await canvas.click({
    position: {
      x: column.x - selecting.x + column.width / 2,
      y: column.y - selecting.y + column.height / 2,
    },
  });
  await expect(page.locator('.inspector-subject h3')).toContainText('Poteau');
  // Nothing can be checked without a material, and the inspector says which.
  await expect(page.locator('.inspector-subject')).toContainText(
    'Aucun matériau',
  );
  expect(errors).toEqual([]);
});

test('browses the whole nomenclature and places what can be placed', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await openDestination(page, 'Équipements');

  // The panel used to list the nineteen generic entries while the rest of the
  // application had been checking the whole nomenclature. « All of them »,
  // whatever the number: declaring a family is a data change, and this test
  // must not be the thing that stops it being one.
  const browser = page.getByRole('region', { name: 'Nomenclature' });
  await expect(browser).toContainText(/(\d+) famille\(s\) sur \1\./u);
  const everything = (await browser.innerText()).match(
    /\d+ famille\(s\) sur \d+\./u,
  )![0];

  const filters = page.getByRole('group', { name: 'Filtrer la nomenclature' });
  await filters.getByLabel('Métier').selectOption('HEATING');
  await expect(browser).not.toContainText(everything);

  // « What can I actually place today » is a question the size makes worth
  // asking, and most families cannot answer it yet.
  await filters.getByLabel('Seulement ce qui est posable').check();
  await browser
    .getByRole('button', { name: /Pompe à chaleur air\/eau monobloc/ })
    .click();
  // A family says what it is, not only what it is called.
  await expect(browser).toContainText('Départ chauffage');
  await expect(browser).toContainText('Prise d’air');

  await browser.getByRole('button', { name: 'Ajouter au projet' }).click();
  await expect(page.getByRole('status')).toBeVisible();
  expect(errors).toEqual([]);
});

test('donne accès aux autres sous-parties depuis le sommaire', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto('/');
  await openStage(page, 'Terrain');

  // Les sous-parties étaient une rangée au-dessus du plan, et ce qu'elles
  // posaient un panneau séparé à gauche : deux endroits pour une seule idée,
  // avec les mêmes boutons aux deux places. Le sommaire de la colonne les
  // tient toutes, et l'ouverte — elle seule — montre ce qu'elle pose.
  await openSection(page, 'Éléments');
  const parts = page.getByRole('navigation', { name: 'Sous-parties' });
  const posables = parts.locator('.add-grid');
  await expect(
    posables.getByRole('button', { name: 'Parcelle', exact: true }),
  ).toBeHidden();

  await openSection(page, 'Parcelle');
  await expect(parts.getByLabel('Parcelle', { exact: true })).toHaveAttribute(
    'aria-current',
    'true',
  );
  // Et ouvrir une sous-partie referme la précédente : on ne travaille qu'à un
  // endroit, et deux listes ouvertes seraient deux endroits où viser.
  await expect(
    posables.getByRole('button', { name: 'Arbre', exact: true }),
  ).toBeHidden();

  await posables.getByRole('button', { name: 'Parcelle', exact: true }).click();
  await expect(toolButton(page, 'Parcelle')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(errors).toEqual([]);
});

test('ne laisse pas modifier la parcelle depuis le bâtiment, ni le bâtiment depuis l’aménagement', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await openInspector(page);
  const canvas = page.locator('.plan-canvas');
  const title = page.locator('.inspector-subject h3');

  /*
   * Les sept espaces sont sept moments, pas sept filtres d'affichage.
   *
   * Le terrain reste dessiné sous la maison quand on dessine la maison, et
   * c'est voulu : on trace des murs *par rapport* à la limite de propriété.
   * Mais un clic un peu large sur ce fond déplaçait la parcelle en croyant
   * viser un mur — on répondait à une question qu'on n'avait pas posée.
   *
   * Ce qu'un espace peut prendre est donc ce qu'il sait poser : Bâtiment
   * dessine des murs, il ne touche pas au terrain ; Aménagement pose des
   * meubles, il ne touche pas aux murs.
   */
  await openStage(page, 'Terrain');
  const parcel = { x: 0.03, y: 0.5 };
  const box = (await canvas.boundingBox())!;
  const onTheParcel = { x: box.width * parcel.x, y: box.height * parcel.y };
  await canvas.click({ position: onTheParcel });
  await expect(title).toContainText('Parcelle');

  // Le même point, dans l'espace du bâtiment, ne prend rien : la parcelle est
  // là, on la voit, on ne l'attrape pas.
  await openStage(page, 'Bâtiment');
  await canvas.click({ position: onTheParcel });
  await expect(page.locator('.inspector-subject')).toHaveCount(0);

  // Et le mur, lui, se prend là où il se dessine.
  const south = (await page.locator('[id="wall:wall-south"]').boundingBox())!;
  const onTheWall = {
    x: south.x - box.x + south.width * 0.25,
    y: south.y - box.y + south.height / 2,
  };
  await canvas.click({ position: onTheWall });
  await expect(title).toContainText('wall-south');

  // Le même mur, depuis l'aménagement, ne se prend plus : on y pose des
  // meubles, et un meuble ne déplace pas une façade.
  await openStage(page, 'Aménagement');
  await canvas.click({ position: onTheWall });
  await expect(page.locator('.inspector-subject')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('mène à l’écran qui débloque, au lieu de le nommer', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/');

  /*
   * Vingt et une tuiles disaient où aller sans pouvoir y mener.
   *
   * « Créez d'abord un réseau de ce métier dans "Réseaux" » est une raison
   * juste, et elle laissait la personne devant un bouton gris en face d'un
   * écran qu'elle devait trouver seule. Une tuile inerte porte un geste :
   * l'outil qui débloque quand c'en est un, l'écran qui débloque sinon.
   */
  await openStage(page, 'Systèmes');
  await openSection(page, 'Eau');
  const parts = page.getByRole('navigation', { name: 'Sous-parties' });
  const blocked = parts.getByRole('button', { name: 'Tracer un tronçon' });
  await expect(blocked).toContainText('réseau');
  // Elle n'est donc pas désactivée : un bouton qu'on annonce inerte et qui
  // agit ment à qui l'écoute, mais un bouton qui mène quelque part agit.
  await expect(blocked).toBeEnabled();

  await blocked.click();
  await expect(page.locator('.network-layout')).toBeVisible();
  expect(errors).toEqual([]);
});

test('pose depuis la nomenclature ce qu’aucun bouton ne nomme', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);

  /*
   * Soixante-dix-neuf familles nommées, trois cent quatre-vingts posables.
   *
   * Les trois cents autres étaient atteignables — la bibliothèque les tient
   * toutes — mais y arriver demandait de quitter le plan, d'ouvrir
   * « Équipements », de chercher, d'ajouter au projet, de revenir, de
   * reprendre l'outil composant et de retrouver la fiche dans une liste
   * déroulante. Six gestes pour poser un variateur.
   */
  await openStage(page, 'Systèmes');
  await openSection(page, 'Électricité');
  const parts = page.getByRole('navigation', { name: 'Sous-parties' });
  await parts.getByRole('button', { name: 'Autre…' }).click();

  // Ouverte sur le métier de la sous-partie : cinq cents familles à plat sont
  // une liste qu'on ne lit pas.
  const picker = page.getByRole('dialog', { name: 'Depuis la nomenclature' });
  await expect(picker).toBeVisible();
  await expect(picker.getByLabel('Métier')).toHaveValue('ELECTRICAL');
  await picker.getByLabel('Rechercher').fill('variateur');
  await picker
    .getByRole('button', { name: /Variateur/u })
    .first()
    .click();

  // Et le bouton dit ce qu'il fait : il pose, il n'archive pas.
  await picker
    .getByRole('button', { name: 'Poser sur le plan' })
    .first()
    .click();
  await expect(picker).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('cliquez');

  // La fiche est installée **et** l'outil la tient : il reste un clic.
  const canvas = page.locator('.plan-canvas');
  const box = (await canvas.boundingBox())!;
  const wall = (await page.locator('[id="wall:wall-south"]').boundingBox())!;
  await canvas.click({
    position: {
      x: wall.x - box.x + wall.width * 0.4,
      y: wall.y - box.y + wall.height / 2,
    },
  });
  await expect(page.getByRole('status')).toContainText('appliqué');
  expect(errors).toEqual([]);
});

test('installe la fiche que le bouton pose, au moment où on le prend', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto('/');

  /*
   * `Aménagement` sur un projet neuf n'avait pas une sous-partie, pas un
   * bouton, rien : les entrées disparaissaient parce que le projet ne tenait
   * pas encore les fiches du catalogue, et la seule issue écrite était
   * « ouvrez la bibliothèque ». C'était punir de ne pas connaître le
   * programme.
   */
  await openStage(page, 'Aménagement');
  await expect(
    page.getByRole('navigation', { name: 'Sous-parties' }).getByRole('button'),
  ).not.toHaveCount(0);

  // Un lit se pose sur quelque chose : la dalle d'abord, comme dans la vraie
  // vie. C'est le refus qu'on lisait avant de savoir si la fiche existait.
  const canvas = page.locator('.plan-canvas');
  const box = (await canvas.boundingBox())!;
  await openStage(page, 'Bâtiment');
  await chooseTool(page, 'Dalle libre');
  for (const corner of [
    { x: 0.2, y: 0.35 },
    { x: 0.75, y: 0.35 },
    { x: 0.75, y: 0.8 },
    { x: 0.2, y: 0.8 },
  ])
    await canvas.click({
      position: { x: box.width * corner.x, y: box.height * corner.y },
    });
  await page.getByRole('button', { name: 'Fermer la surface' }).first().click();

  await openStage(page, 'Aménagement');
  await chooseTool(page, 'Lit');
  // Au milieu de la dalle telle qu'elle est dessinée : le plan se recadre
  // quand le modèle grandit, et une fraction du cadre ne vise plus rien.
  //
  // On attend qu'elle soit dessinée avant de la mesurer : `boundingBox()` ne
  // patiente pas, il rend `null` sur un dessin qui n'a pas encore repeint.
  const drawn = page.locator('[id^="slab:"]').first();
  await expect(drawn).toBeVisible();
  const slab = (await drawn.boundingBox())!;
  const frame = (await canvas.boundingBox())!;
  await canvas.click({
    position: {
      x: slab.x - frame.x + slab.width / 2,
      y: slab.y - frame.y + slab.height / 2,
    },
  });
  await expect(page.locator('[id^="component:"]')).not.toHaveCount(0);
  expect(errors).toEqual([]);
});

test('dit combien d’étages la maison a, et copie la base sur chacun', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto('/');
  await openStage(page, 'Bâtiment');

  /*
   * Le nombre d'étages se décidait dans l'assistant de création, une fois
   * pour toutes, ou s'empilait à la main dans l'éditeur avancé. « Je fais une
   * maison à deux étages » est une phrase qu'on dit en dessinant.
   */
  const canvas = page.locator('.plan-canvas');
  const box = (await canvas.boundingBox())!;
  await chooseTool(page, 'Murs rectangle');
  await canvas.click({
    position: { x: box.width * 0.25, y: box.height * 0.4 },
  });
  await canvas.click({ position: { x: box.width * 0.7, y: box.height * 0.8 } });
  const walls = page.locator('[data-role="WALL_CUT"][id^="wall:"]');
  await expect(walls).toHaveCount(4);

  const storeys = page.getByRole('group', { name: 'Niveaux du bâtiment' });
  await expect(storeys).toContainText('1');
  await storeys.getByRole('button', { name: 'Ajouter un niveau' }).click();

  // Les murs porteurs montent : c'est ce qu'on ne veut pas retracer.
  const levels = page.getByRole('group', { name: 'Niveaux', exact: true });
  await expect(levels.getByRole('button')).toHaveCount(2);
  await levels.getByRole('button').nth(1).click();
  await expect(walls).toHaveCount(4);

  // Et le retirer dit ce qui l'en empêche, avant le clic plutôt qu'après.
  await expect(
    storeys.getByRole('button', { name: 'Retirer un niveau' }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});

test('pose un relevé sous le dessin, et ne le sélectionne jamais', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto('/');
  await openStage(page, 'Terrain');

  /*
   * On commence rarement une maison sur une feuille blanche : un cadastre, un
   * plan de géomètre, une photo d'esquisse. Il n'y avait aucun moyen de mettre
   * ce qu'on a sous ce qu'on trace.
   */
  const control = page.getByRole('group', { name: 'Image de fond' });
  await expect(control).toBeVisible();
  // Un damier de deux pixels : ce qu'on éprouve est le calque, pas l'image.
  await page.getByLabel('Choisir une image de fond').setInputFiles({
    name: 'cadastre.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAF0lEQVR4nGP8//8/AzJgYkAD5AswMDAAAOZLAwXqtcMdAAAAAElFTkSuQmCC',
      'base64',
    ),
  });

  const underlay = page.locator('.underlay-image');
  await expect(underlay).toBeVisible();
  // Il ne prend aucun clic, et il n'est annoncé à personne : un calque se
  // regarde, il ne se désigne pas.
  await expect(underlay).toHaveCSS('pointer-events', 'none');
  await expect(underlay).toHaveAttribute('aria-hidden', 'true');

  // Cliquer au travers dessine : c'est tout l'intérêt de tracer par-dessus.
  const canvas = page.locator('.plan-canvas');
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * 0.4, y: box.height * 0.5 } });
  await expect(page.locator('.inspector-subject')).toHaveCount(0);

  // Les réglages sont déjà là : on vient de poser une image, la première
  // chose qu'on en fait est de dire ce qu'elle mesure.
  await page.getByLabel('Largeur de l’image en mètres').fill('40');
  await expect(control.getByRole('button', { name: /^Fond ·/u })).toContainText(
    '40,00 m',
  );

  // Et le retirer ne laisse rien.
  await control.getByRole('button', { name: 'Retirer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Retirer l’image');
  await expect(page.locator('.underlay-image')).toHaveCount(0);
  expect(errors).toEqual([]);
});
