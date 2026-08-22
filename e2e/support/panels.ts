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
