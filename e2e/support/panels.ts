import { expect, type Page } from '@playwright/test';

/**
 * Les parties du panneau de contexte qu'un test doit atteindre.
 *
 * Les vingt cases de calques sont le moteur derrière les presets de
 * visibilité, et restent atteignables : un test les ouvre comme une personne
 * le ferait. L'arborescence, elle, ne se range plus.
 */
/**
 * L'arborescence est permanente : il n'y a plus rien à ouvrir.
 *
 * Elle vivait derrière « ☰ Modèle » ; une question qu'on se pose sans arrêt ne
 * se range pas. Le helper reste pour que les tests disent encore ce qu'ils
 * font — et pour attendre qu'elle soit là.
 */
export async function openModelTree(page: Page): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Arborescence du projet' })
    .waitFor();
}

/**
 * Le panneau d'affichage, ouvert comme une personne l'ouvre.
 *
 * Il y avait deux écrans pour une question : `LayersPanel` dans la colonne de
 * gauche et `VisibilityPopover` au-dessus du plan. Il n'en reste qu'un, contre
 * le dessin, derrière le bouton « Affichage » de la barre de vue.
 */
export async function openDisplayPanel(page: Page): Promise<void> {
  const panel = page.getByRole('dialog', { name: 'Affichage' });
  if (await panel.isVisible()) return;
  await page.getByRole('button', { name: /^Affichage/u }).click();
  await panel.waitFor();
}

/**
 * Et refermé, parce qu'il flotte au-dessus du dessin.
 *
 * C'était un dépliage du panneau gauche, qu'on pouvait laisser ouvert sans
 * conséquence. C'est maintenant une boîte de dialogue contre le plan : la
 * laisser ouverte, c'est laisser un test cliquer à travers.
 */
export async function closeDisplayPanel(page: Page): Promise<void> {
  const panel = page.getByRole('dialog', { name: 'Affichage' });
  if (!(await panel.isVisible())) return;
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
}

/** Le préréglage de visibilité, choisi par son nom, puis le plan rendu. */
export async function choosePreset(page: Page, label: string): Promise<void> {
  await openDisplayPanel(page);
  await page
    .getByRole('dialog', { name: 'Affichage' })
    .getByRole('button', { name: label, exact: true })
    .click();
  await closeDisplayPanel(page);
}

/** Les vingt-huit cases, sous leur dépliage, dans le même panneau. */
export async function openLayerEditor(page: Page): Promise<void> {
  await openDisplayPanel(page);
  const list = page.locator('.display-panel .layer-list');
  if (await list.isVisible()) return;
  await page.getByText(/^Calque par calque/u).click();
  await list.waitFor();
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
  await closeDisplayPanel(page);
}

/**
 * L'inspecteur, ouvert avant de mesurer le dessin.
 *
 * Tant que rien n'a jamais été désigné, l'inspecteur ne réserve pas ses 280 px
 * — c'est le repli automatique de UX-1. Il s'ouvre à la première sélection, et
 * le canvas rétrécit d'autant : un test qui relève une position dans le plan,
 * clique, puis reclique au même endroit cliquerait deux fois sur deux dessins
 * différents. L'ouvrir d'abord fige la mise en page, comme le ferait quelqu'un
 * qui veut voir les propriétés sous les yeux avant de choisir un objet.
 */
export async function openInspector(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: 'Inspecteur', exact: true });
  if ((await toggle.getAttribute('aria-pressed')) === 'true') return;
  await toggle.click();
}
