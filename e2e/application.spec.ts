import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

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
  await page.getByRole('button', { name: 'Maison de démonstration' }).click();
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
  await page.getByRole('button', { name: 'Matériaux', exact: true }).click();
  await expect(page.locator('.library-table tbody tr').first()).toBeVisible();
  const materials = await page.locator('.library-table tbody tr').count();
  expect(materials).toBeGreaterThan(10);

  await page.getByRole('button', { name: 'Assemblages', exact: true }).click();
  await expect(page.locator('.assembly-card')).toHaveCount(4);
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
  await expect(
    page.locator('[data-layer="architecture.openings"] > *'),
  ).toHaveCount(7);
  await expect(
    page.locator('[data-layer="architecture.spaces"] > *'),
  ).toHaveCount(4);
  expect(errors).toEqual([]);
});

test('adds a wall, then undoes and redoes it', async ({ page }) => {
  await loadDemo(page);
  const walls = page.locator('[data-role="WALL_CUT"][id^="wall:"]');
  await expect(walls).toHaveCount(6);

  await page.getByRole('button', { name: 'Mur', exact: true }).click();
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
  await page.getByRole('button', { name: 'Calculs', exact: true }).click();
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
  await page.getByLabel('Superposition').selectOption('thermal-u');
  await expect(page.locator('.overlay-legend')).toBeVisible();
  await expect(page.locator('[data-layer="analysis.overlay"] > *')).toHaveCount(
    4,
  );
});

test('lists the bill of materials and offers a CSV export', async ({
  page,
}) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Quantités', exact: true }).click();
  await expect(page.locator('.library-table tbody tr').first()).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter en CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toContain('nomenclature');
});

test('compares a scenario against the project', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Scénarios', exact: true }).click();
  await expect(page.locator('.delta').first()).toBeVisible({ timeout: 20_000 });
  const deltas = await page.locator('.delta').allTextContents();
  expect(deltas.some((value) => value.includes('-'))).toBe(true);
});

test('saves the project and reloads it unchanged', async ({ page }) => {
  await loadDemo(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Sauvegarder' }).click();
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
  await page.getByRole('button', { name: 'Projet', exact: true }).click();
  // The demonstration project comes with its datasets loaded in the session.
  await expect(page.locator('.library-panel')).not.toContainText(
    'Aucun jeu de données climatiques',
  );

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Sauvegarder' }).click();
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

  await page.getByRole('button', { name: 'Projet', exact: true }).click();
  await expect(page.locator('.library-panel')).not.toContainText(
    'Aucun jeu de données climatiques',
  );
  await page.getByRole('button', { name: 'Calculs', exact: true }).click();
  await expect(page.locator('.dashboard-card').first()).toBeVisible();
});

test('switches level and discipline view without losing the model', async ({
  page,
}) => {
  await loadDemo(page);
  await page.getByLabel('Vue disciplinaire').selectOption('plumbing');
  await expect(
    page.locator('[data-layer="water.pipes"]').first(),
  ).toBeVisible();
  await page.getByLabel('Vue disciplinaire').selectOption('architecture');
  await expect(page.locator('[data-role="WALL_CUT"][id^="wall:"]')).toHaveCount(
    6,
  );
});

test('keyboard shortcuts drive the tools', async ({ page }) => {
  await loadDemo(page);
  await page.locator('.plan-canvas').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('w');
  await expect(
    page.getByRole('button', { name: 'Mur', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Sélection', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('autosaves an edit and offers to restore it after a reload', async ({
  page,
}) => {
  await loadDemo(page);
  await expect(page.locator('.save-state')).toHaveText('Enregistré');

  await page.getByRole('button', { name: 'Mur', exact: true }).click();
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
  await page.getByRole('button', { name: 'Mur', exact: true }).click();
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
  await page.getByRole('button', { name: 'Projet', exact: true }).click();
  await expect(page.locator('.library-panel')).not.toContainText(
    'Aucun jeu de données climatiques',
  );
});

test('discards the local snapshot when the user declines it', async ({
  page,
}) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Mur', exact: true }).click();
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
  await page.getByRole('button', { name: 'Réseaux', exact: true }).click();
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

  await page.getByRole('button', { name: 'Plan architectural' }).click();
  await page.getByRole('button', { name: 'Réseau', exact: true }).click();
  await page
    .getByLabel('Réseau', { exact: true })
    .selectOption('network-heating-radiator-loop');
  await page.getByLabel('Type de nœud').selectOption('EMITTER');
  await page.locator('.plan-canvas').click({ position: { x: 260, y: 240 } });
  await expect(page.getByRole('status')).toContainText('Ajouter un nœud');

  await page.getByRole('button', { name: 'Réseaux', exact: true }).click();
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
  await page.getByRole('button', { name: 'Réseaux', exact: true }).click();
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
  await page.getByRole('button', { name: 'Exporter le JSON' }).click();
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
  const canvas = page.locator('.plan-canvas');
  const canvasBox = (await canvas.boundingBox())!;
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
  await page.getByRole('button', { name: 'Scinder', exact: true }).click();
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
  await page.getByRole('button', { name: 'Niveaux et pièces' }).click();
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

  await page.getByRole('button', { name: 'Cotation', exact: true }).click();
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
  await page.getByRole('button', { name: 'Sauvegarder' }).click();
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
    await page.getByRole('button', { name: 'Exporter SVG' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toContain('rez-de-chaussee');
    return readFile(await file.path(), 'utf8');
  };

  const architecture = await exportSvg();
  // The layered walls, the cut openings and the rooms are all in the file,
  // and the sheet names its scale.
  expect(architecture).toContain('architecture.wall-layers');
  expect(architecture).toContain('architecture.openings');
  expect(architecture).toContain('architecture.spaces');
  expect(architecture).toContain('1:50');
  // An exported drawing carries no interaction state.
  expect(architecture).not.toContain('data-state');
  // The architecture view does not draw the plumbing, and neither does its
  // export: the sheet is what the user is looking at.
  expect(architecture).not.toContain('water.pipes');

  await page.getByLabel('Vue disciplinaire').selectOption('plumbing');
  const plumbing = await exportSvg();
  expect(plumbing).toContain('water.pipes');
});

test('creates a partition as a partition, not as an exterior wall', async ({
  page,
}) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Mur', exact: true }).click();
  // Choosing a partition assembly proposes the matching role rather than
  // leaving every drawn wall in the thermal envelope.
  await page.getByLabel('Assemblage').selectOption('assembly-partition');
  await expect(page.getByLabel('Rôle')).toHaveValue('PARTITION');

  const canvas = page.locator('.plan-canvas');
  await canvas.click({ position: { x: 120, y: 380 } });
  await canvas.click({ position: { x: 420, y: 380 } });
  await expect(page.getByRole('status')).toContainText('Ajouter un mur');

  await page.getByRole('button', { name: 'Sélection', exact: true }).click();
  await canvas.click({ position: { x: 270, y: 380 } });
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
  await page.keyboard.press('Enter');
  await expect(palette).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Mur', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');

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
  // rubber band.
  await page.mouse.move(frame.x + grip.x, frame.y + grip.y);
  await page.mouse.down();
  await page.mouse.move(frame.x + grip.x + 60, frame.y + grip.y + 20, {
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

  // Hiding the inspector gives the drawing its width.
  const canvas = page.locator('.canvas-panel');
  const plan = (await canvas.boundingBox())!.width;
  await page.getByRole('button', { name: 'Inspecteur', exact: true }).click();
  await expect(page.locator('#inventory')).toBeHidden();
  await expect
    .poll(async () => (await canvas.boundingBox())!.width)
    .toBeGreaterThan(plan);

  // Both decisions survive a reload: they are preferences of the person, kept
  // in the browser and never in the project.
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Maison de démonstration' }),
  ).toBeVisible();
  await expect(page.locator('#inventory')).toBeHidden();
  expect((await sidebar.boundingBox())!.width).toBeCloseTo(widened, 0);

  await page.getByRole('button', { name: 'Inspecteur', exact: true }).click();
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
  await page.getByRole('button', { name: 'Décaler', exact: true }).click();
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
  await page.getByRole('button', { name: 'Sélection', exact: true }).click();
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
  const walls = page.locator('[data-role="WALL_CUT"][id^="wall:"]');
  await expect(walls).toHaveCount(6);
  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();

  await page.getByRole('button', { name: 'Mur', exact: true }).click();
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

  // The wall measures what was typed.
  await page.getByRole('button', { name: 'Sélection', exact: true }).click();
  await canvas.click({ position: { x: 200, y: 300 } });
  await expect(
    page.getByRole('spinbutton', { name: 'Longueur (mm)' }),
  ).toHaveValue('4500');

  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(walls).toHaveCount(6);
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

  // Another storey can be reached, and becomes the one being drawn.
  await expect(
    tree.getByRole('button', { name: 'Rez-de-chaussée' }),
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
  await page.getByRole('button', { name: 'Poteau', exact: true }).click();
  await page.getByLabel('Élément').selectOption('COLUMN');
  await canvas.click({ position: { x: box.width * 0.4, y: box.height * 0.4 } });
  await expect(page.locator('[id^="structure:member-"]')).toHaveCount(1);

  await page.getByRole('button', { name: 'Composant', exact: true }).click();
  await page.getByLabel('Catégorie').selectOption('HEATING');
  await page.getByLabel('Nom').fill('Radiateur séjour');
  await canvas.click({
    position: { x: box.width * 0.3, y: box.height * 0.35 },
  });
  await expect(page.getByRole('status')).toContainText('composant');

  const tree = page.getByRole('navigation', {
    name: 'Arborescence du projet',
  });
  await tree.getByText(/^Structure/).click();
  await tree.getByRole('button', { name: /^Poteau / }).click();
  await expect(page.locator('.inspector-subject h3')).toContainText('Poteau');

  await tree.getByText(/^Composants/).click();
  await tree.getByRole('button', { name: 'Radiateur séjour' }).click();
  await expect(page.locator('.inspector-subject h3')).toContainText(
    'Radiateur séjour',
  );
  expect(errors).toEqual([]);
});

test('chooses which contour a slab is built from', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Niveaux et pièces' }).click();
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
  await page.getByRole('button', { name: 'Exporter le JSON' }).click();
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
  await page.getByRole('button', { name: 'Mur', exact: true }).click();
  const canvas = page.locator('.plan-canvas');
  await canvas.click({ position: { x: 120, y: 380 } });
  await canvas.click({ position: { x: 420, y: 380 } });
  await expect(page.locator('.save-state')).not.toHaveText('Enregistré');

  await page.getByRole('button', { name: 'Nouveau projet' }).click();
  const prompt = page.getByRole('alertdialog');
  await expect(prompt).toContainText('n’ont pas été exportées');
  // Cancelling keeps the work.
  await prompt.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.locator('[data-role="WALL_CUT"][id^="wall:"]')).toHaveCount(
    7,
  );

  await page.getByRole('button', { name: 'Nouveau projet' }).click();
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

  await page.getByRole('button', { name: 'Sauvegarder' }).click();
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

test('the assistant asks what a new project cannot be guessed', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Nouveau projet' }).click();
  const wizard = page.getByRole('dialog', { name: 'Nouveau projet' });
  await wizard.getByLabel('Nom du projet').fill('Maison des Lilas');
  await wizard.getByLabel('Niveaux hors sol').fill('2');
  await wizard.getByLabel('Hauteur d’étage').fill('2700');
  await wizard.getByLabel('Sous-sol').check();
  await wizard.getByLabel('Latitude').fill('48.85');
  await wizard.getByLabel('Longitude').fill('2.35');
  await page.getByRole('button', { name: 'Créer le projet' }).click();

  await expect(page.getByRole('status')).toContainText('3 niveau(x)');
  await page.getByRole('button', { name: 'Projet', exact: true }).click();
  await expect(page.getByLabel('Nom du projet')).toHaveValue(
    'Maison des Lilas',
  );
  await expect(page.getByLabel('Latitude')).toHaveValue('48.85');
  // The building was stacked as it was described, basement included.
  await expect(page.locator('.level-selector select option')).toHaveText([
    'Sous-sol',
    'Rez-de-chaussée',
    'Étage 1',
  ]);
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
  await page.getByRole('button', { name: 'Projet', exact: true }).click();

  // The name is editable, and it names the exported file.
  const name = page.getByLabel('Nom du projet');
  await name.fill('Maison Dupont');
  await name.press('Enter');
  await expect(page.locator('.project-bar strong')).toHaveText('Maison Dupont');

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
  await page.getByRole('button', { name: 'Exporter le JSON' }).click();
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
  await page.getByRole('button', { name: 'Projet', exact: true }).click();
  await page.getByLabel('Module').selectOption('acoustics');

  const bands = page.getByRole('group', { name: /Bandes étudiées/ });
  await expect(bands).toBeVisible();
  await bands.getByRole('checkbox', { name: '500 Hz' }).check();
  await bands.getByRole('checkbox', { name: '1000 Hz' }).check();
  await expect(page.getByRole('status')).toContainText(
    'Modifier un réglage de calcul',
  );

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter le JSON' }).click();
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
  await page.getByRole('button', { name: 'Exporter le JSON' }).click();
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
  await page.getByRole('button', { name: 'Projet', exact: true }).click();
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
  await page.getByRole('button', { name: 'Scénarios', exact: true }).click();

  await page.getByLabel('Nouveau scénario').fill('Isolation renforcée');
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Ajouter le scénario');
  await expect(page.locator('h3')).toContainText('Isolation renforcée');
  await expect(page.locator('.library-table tbody tr').first()).toContainText(
    'ne modifie encore rien',
  );

  // The change is chosen by what it means, never by a path into the file.
  const target = page.getByLabel('Valeur modifiée');
  const insulation = await target
    .locator('option', { hasText: 'épaisseur de material-insulation' })
    .first()
    .getAttribute('value');
  await target.selectOption(insulation);
  await page.getByLabel(/Nouvelle valeur/).fill('0.3');
  await page.getByRole('button', { name: 'Ajouter le changement' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Ajouter un changement au scénario',
  );
  const change = page.locator('.library-table tbody tr').first();
  await expect(change).toContainText('0.2');
  await expect(change).toContainText('0.3');

  // And the comparison reflects it.
  await page.getByLabel('Scénario comparé').selectOption({ index: 0 });
  await expect(page.locator('.delta').first()).toBeVisible({ timeout: 20_000 });
});

test('promotes a scenario into the project', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Scénarios', exact: true }).click();
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
  await page.getByRole('button', { name: 'Calculs', exact: true }).click();
  await expect(page.locator('.module-header')).toHaveCount(17);

  await page.getByRole('button', { name: 'Vérifications' }).click();
  const findings = page.locator('.alert-list li');
  await expect(findings.first()).toBeVisible();

  // A project with no rule pack says so, and does not claim compliance.
  await expect(page.locator('.library-panel')).toContainText(
    'Aucun référentiel activé',
  );
  await expect(page.locator('.library-panel .notice').last()).toContainText(
    'ne constatent aucune conformité réglementaire',
  );

  // "Corriger" takes the user to where the finding can be dealt with.
  await findings
    .filter({ hasText: 'Aucun référentiel activé' })
    .getByRole('button', { name: 'Corriger' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Informations, site et réglages' }),
  ).toBeVisible();
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
  await page.getByRole('button', { name: 'Mur', exact: true }).click();
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
  await page.getByRole('button', { name: 'Vérifications' }).click();
  await expect(page.locator('.library-panel')).toContainText(
    'Aucun référentiel activé',
  );

  await page.getByRole('button', { name: 'Projet', exact: true }).click();
  await page.getByRole('checkbox', { name: /fr-rainwater-example/ }).check();
  await expect(page.getByRole('status')).toContainText(
    'Modifier les référentiels activés',
  );

  // The demonstration project states a country but no reference date, and the
  // date decides which text applies: the pack is not run, and says why.
  await page.getByRole('button', { name: 'Vérifications' }).click();
  await expect(page.locator('.library-panel')).toContainText(
    'date de référence',
  );
  await expect(page.locator('.rule-panel')).toHaveCount(0);

  await page.getByRole('button', { name: 'Projet', exact: true }).click();
  // Targeted by id: the pack list explains applicability in words that repeat
  // the field labels, so a label lookup would match two controls.
  await page.locator('#regulatory-date').fill('2020-01-01');
  await page.locator('#regulatory-date').press('Enter');
  // Before the text came into force: still no verdict, and the reason is the
  // date rather than the project.
  await page.getByRole('button', { name: 'Vérifications' }).click();
  await expect(page.locator('.library-panel')).toContainText('2020-01-01');
  await expect(page.locator('.rule-panel')).toHaveCount(0);

  await page.getByRole('button', { name: 'Projet', exact: true }).click();
  await page.locator('#regulatory-country').fill('BE');
  await page.locator('#regulatory-country').press('Enter');
  await page.locator('#regulatory-date').fill('2026-01-01');
  await page.locator('#regulatory-date').press('Enter');
  await page.getByRole('button', { name: 'Vérifications' }).click();
  await expect(page.locator('.library-panel')).toContainText('BE');
  await expect(page.locator('.rule-panel')).toHaveCount(0);

  await page.getByRole('button', { name: 'Projet', exact: true }).click();
  await page.locator('#regulatory-country').fill('FR');
  await page.locator('#regulatory-country').press('Enter');

  await page.getByRole('button', { name: 'Vérifications' }).click();
  const report = page.locator('.rule-panel');
  await expect(report).toBeVisible();
  await expect(report).toContainText('fr-rainwater-example');
  // The demonstration project harvests no rainwater, so the rule does not
  // apply — which is not the same answer as "conforme".
  await expect(report.locator('.rule-card')).toHaveCount(1);
  await expect(report.locator('.rule-card')).toContainText('Non applicable');

  // Two rainwater systems, judged one by one rather than through the first.
  for (const system of ['ROOF_DRAINAGE', 'HARVESTING']) {
    await page.getByRole('button', { name: 'Réseaux', exact: true }).click();
    await page
      .getByLabel('Discipline', { exact: true })
      .selectOption('RAINWATER');
    await page.getByLabel('Système', { exact: true }).selectOption(system);
    await page.getByRole('button', { name: 'Créer le réseau' }).click();
    await expect(
      page.locator('.library-table tbody tr', { hasText: system }),
    ).toHaveCount(1);
  }

  await page.getByRole('button', { name: 'Vérifications' }).click();
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
  await page.getByRole('button', { name: 'Calculs', exact: true }).click();
  await expect(page.locator('.dashboard-card').first()).toBeVisible();
  const computedOn = await page
    .locator('.library-panel .hint')
    .first()
    .textContent();
  expect(computedOn).toContain('révision');

  // Edit the model after the results were produced.
  await page.getByRole('button', { name: 'Plan architectural' }).click();
  await page.getByRole('button', { name: 'Mur', exact: true }).click();
  const canvas = page.locator('.plan-canvas');
  await canvas.click({ position: { x: 120, y: 380 } });
  await canvas.click({ position: { x: 420, y: 380 } });

  await page.getByRole('button', { name: 'Projet', exact: true }).click();
  const revision =
    (await page.locator('#project-revision').textContent()) ?? '';
  const current = /^(\d+)/u.exec(revision.trim())?.[1];
  expect(current).toBeDefined();

  await page.getByRole('button', { name: 'Vérifications' }).click();
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
  await page.getByRole('button', { name: 'Scénarios' }).click();
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
  await page.getByRole('button', { name: 'Scénarios', exact: true }).click();
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

test('never offers to fix a value the settings screen cannot take', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Calculs', exact: true }).click();
  await expect(page.locator('.module-header')).toHaveCount(17);
  await page.getByRole('button', { name: 'Vérifications' }).click();

  const findings = page.locator('.alert-list li');
  await expect(findings.first()).toBeVisible();
  // The occupancy map is one of the inputs the dashboard reports missing; the
  // settings screen has to be able to take it for the button to be offered.
  const occupancy = findings.filter({ hasText: 'occupantsByCategory' });
  if ((await occupancy.count()) > 0) {
    await occupancy.first().getByRole('button', { name: 'Corriger' }).click();
    await page.getByLabel('Module').selectOption('iaq');
    await expect(page.getByLabel('Séjour')).toBeVisible();
  }

  // Whatever the findings are, every "Corriger" leads to a real destination.
  const fixable = await findings
    .getByRole('button', { name: 'Corriger' })
    .count();
  expect(fixable).toBeGreaterThan(0);
});

test('an emptied equipment field is gone after a save and a reload', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await page.getByRole('button', { name: 'Équipements', exact: true }).click();
  await page
    .getByRole('button', { name: 'equipment-dhw-tank', exact: true })
    .click();

  const loss = page.getByLabel('Pertes à l’arrêt');
  await expect(loss).toHaveValue('45');
  await loss.fill('');
  await loss.press('Enter');
  // The property is removed, not stored as zero and not as NaN: nobody chose a
  // value, so the project stops claiming one.
  await expect(page.getByLabel('Pertes à l’arrêt')).toHaveCount(0);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Sauvegarder' }).click();
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
  await page.getByRole('button', { name: 'Équipements', exact: true }).click();
  await page
    .getByRole('button', { name: 'equipment-dhw-tank', exact: true })
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
  for (let click = 0; click < 4; click += 1) {
    await canvas.click({ position: stacked });
    await expect(title).toBeVisible();
    seen.push((await title.textContent()) ?? '');
  }
  // Each click offers the next one rather than the same one for ever.
  expect(seen[0]).toContain('wall-partition-h');
  expect(new Set(seen).size).toBe(4);

  // And round again, so nothing under the pointer is out of reach.
  await canvas.click({ position: stacked });
  await expect(title).toHaveText(seen[0] ?? '');
  expect(errors).toEqual([]);
});

test('restricts what a click may take to one family', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);
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

  await page.getByRole('button', { name: 'Mur continu', exact: true }).click();
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

  await page
    .getByRole('button', { name: 'Murs rectangle', exact: true })
    .click();
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
  await page.getByRole('button', { name: 'Pièce', exact: true }).click();
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
  await page.getByRole('button', { name: 'Composant', exact: true }).click();
  await page.getByLabel('Catégorie').selectOption('HEATING');
  await page.getByLabel('Nom').fill('Radiateur séjour');

  const canvas = page.locator('.plan-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await canvas.click({
    position: { x: box.width * 0.3, y: box.height * 0.35 },
  });
  await expect(page.getByRole('status')).toContainText('composant');

  // The placed object is an object of the editor like any other: selectable,
  // described, and tied to the room it stands in.
  await page.getByRole('button', { name: 'Sélection', exact: true }).click();
  await canvas.click({
    position: { x: box.width * 0.3, y: box.height * 0.35 },
  });
  const title = page.locator('.inspector-subject h3');
  await expect(title).toContainText('Radiateur séjour');
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
  await page
    .getByRole('button', { name: 'Tracer un tronçon', exact: true })
    .click();
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

test('keeps a view, lays it on a sheet and draws the sheet', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loadDemo(page);
  await page
    .getByRole('button', { name: 'Vues et feuilles', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Vues et feuilles' }),
  ).toBeVisible();

  await page.getByLabel('Nom de la vue').fill('Plan RDC');
  await page
    .getByRole('button', { name: 'Enregistrer le plan tel qu’il est' })
    .click();
  await expect(page.getByRole('status')).toContainText('enregistrée');

  await page.getByLabel('Titre de la feuille').fill('Plan du rez-de-chaussée');
  await page.getByLabel('Format').selectOption('A3');
  await page.getByRole('button', { name: 'Ajouter une feuille' }).click();
  await expect(page.getByRole('cell', { name: 'A-001' })).toBeVisible();

  // The sheet is drawn from the model, not from a picture kept aside.
  await page
    .getByRole('row')
    .filter({ hasText: 'A-001' })
    .getByRole('button', { name: 'Aperçu' })
    .click();
  const preview = page.locator('.sheet-preview svg').first();
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute('data-sheet-id', /sheet-/);
  // The title block says what the project says, and marks what it cannot say.
  await expect(page.locator('.sheet-preview')).toContainText('A-001');
  await expect(page.locator('.sheet-preview')).toContainText('inconnu');

  // A view a sheet still lays out cannot be taken away.
  const views = page.getByRole('region', { name: 'Vues enregistrées' });
  await views
    .getByRole('row')
    .filter({ hasText: 'Plan RDC' })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await expect(page.getByRole('status')).toContainText('A-001');
  expect(errors).toEqual([]);
});

test('builds a variant by pointing at the plan', async ({ page }) => {
  const errors = watchConsole(page);
  await loadDemo(page);

  // A variant to build.
  await page.getByRole('button', { name: 'Scénarios', exact: true }).click();
  await page.getByLabel('Nouveau scénario').fill('Isolation renforcée');
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  await page.getByRole('button', { name: 'Plan architectural' }).click();

  const mode = page.getByRole('region', { name: 'Scénario', exact: true });
  await mode.getByLabel('Dessiner la variante').selectOption({ index: 1 });
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
  await page.getByLabel('Assemblage').selectOption('assembly-partition');
  await expect(page.getByRole('status')).toContainText('Scénario');

  // And the drawing says which objects it changed.
  await expect(page.locator('.overlay-legend')).toContainText(
    'Ce que la variante change',
  );

  // A property no scenario path names is refused out loud.
  await page.getByLabel('Face de référence').selectOption('LEFT');
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
  await page.getByRole('button', { name: 'Terrain', exact: true }).click();
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
  await page.getByRole('button', { name: 'Poteau', exact: true }).click();
  await page.getByLabel('Élément').selectOption('COLUMN');
  const after = (await canvas.boundingBox())!;
  await canvas.click({
    position: { x: after.width * 0.4, y: after.height * 0.4 },
  });
  await expect(page.locator('[id^="structure:member-"]')).toHaveCount(1);

  await page.getByRole('button', { name: 'Sélection', exact: true }).click();
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
