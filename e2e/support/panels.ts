import { expect, type Page } from '@playwright/test';

import { openStage } from './navigation.js';

/**
 * Les parties du panneau de contexte qu'un test doit atteindre.
 *
 * Les vingt cases de calques sont le moteur derrière les presets de
 * visibilité, et restent atteignables : un test les ouvre comme une personne
 * le ferait. L'arborescence, elle, est passée sous « Ajouter ».
 */
/**
 * L'arborescence, dépliée comme une personne la déplie.
 *
 * Elle occupait toute la colonne de gauche et racontait ce que le projet
 * **contient** ; ce qu'on vient y faire, c'est **ajouter**. Ce que la
 * sous-partie sait poser est donc passé devant, et l'arborescence est passée
 * dessous, derrière « Éléments du projet » — accessible, secondaire.
 *
 * Le helper dit encore ce que fait le test : il ouvre le dépliage si besoin,
 * puis attend l'arborescence.
 */
export async function openModelTree(page: Page): Promise<void> {
  const tree = page.getByRole('navigation', { name: 'Arborescence du projet' });
  if (!(await tree.isVisible())) {
    const fold = page.locator('details.project-tree-fold > summary');
    if ((await fold.count()) > 0) await fold.click();
  }
  await tree.waitFor();
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

/**
 * La superposition d'analyse, là où elle vit.
 *
 * Elle était offerte dans les sept espaces : vingt analyses dans la colonne du
 * terrain, dans celle des documents, dans celle du projet. Un panneau qui
 * répond à une question qu'on ne se pose pas ici est du bruit permanent. Elle
 * **est** l'espace Études : une superposition colorée est une étude qu'on lit
 * sur le dessin plutôt que dans un tableau.
 */
export async function chooseOverlay(page: Page, value: string): Promise<void> {
  const picker = page.getByLabel('Superposition');
  if (!(await picker.isVisible())) {
    await openStage(page, 'Études');
    // Études s'ouvre sur sa vue d'ensemble : colorer le dessin veut dire
    // ouvrir le dessin, et c'est la dernière destination de cet espace.
    const plan = page
      .locator('#workspace-sidebar')
      .getByRole('button', { name: 'Plan', exact: true });
    if ((await plan.count()) > 0) await plan.first().click();
  }
  await picker.selectOption(value);
}

/**
 * Les dégagements, là où ils vivent.
 *
 * Ils comptent quand on pose des objets et quand on tire des réseaux : un
 * lave-linge sans son mètre devant est un lave-linge qu'on n'ouvre pas.
 */
export async function openClearances(page: Page): Promise<void> {
  const panel = page.getByRole('group', { name: 'Dégagements sur le plan' });
  if (!(await panel.isVisible())) await openStage(page, 'Aménagement');
  await panel.waitFor();
}
