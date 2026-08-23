import type { Page } from '@playwright/test';

/**
 * The two parts of the context panel that are now folded away.
 *
 * The model tree is a way of finding an object rather than a way of working,
 * and the twenty layer checkboxes are the engine behind the visibility
 * presets. Both stay reachable — a test opens them the way a person does.
 */
export async function openModelTree(page: Page): Promise<void> {
  const tree = page.getByRole('navigation', { name: 'Arborescence du projet' });
  if (await tree.isVisible()) return;
  await page.getByText('☰ Modèle').click();
}

export async function openLayerEditor(page: Page): Promise<void> {
  const editor = page.getByLabel('Vue disciplinaire');
  if (await editor.isVisible()) return;
  await page.getByText('Calques (avancé)').click();
}

/**
 * Turning the placed equipment off, the way a person does it.
 *
 * A test that clicks a wall clicks whatever is drawn over it, and the
 * reference house is furnished: radiators stand along the outside walls, which
 * is where radiators go. Aiming at a patch of wall no symbol happens to cover
 * would make the test depend on where the furniture is; turning the layer off
 * is what the layer editor is for, and it is what somebody would actually do
 * to reach the wall underneath.
 */
export async function hidePlacedComponents(page: Page): Promise<void> {
  await openLayerEditor(page);
  const placed = page.getByRole('checkbox', { name: 'Équipements posés' });
  if (await placed.isChecked()) await placed.uncheck();
}
