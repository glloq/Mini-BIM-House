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
  await expect(page.locator('.module-header')).toHaveCount(16);
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
  await page.getByLabel('Type de système').fill('RADIATOR_LOOP');
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
  await page.getByRole('button', { name: 'Sauvegarder' }).click();
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
  await expect(page.getByRole('status')).toContainText('Nouveau projet');
});
