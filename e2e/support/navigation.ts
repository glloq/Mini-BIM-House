import type { Page } from '@playwright/test';

/**
 * Ouvrir une destination, comme une personne le fait.
 *
 * Les treize destinations ne sont plus treize boutons d'une colonne : on les
 * atteint par l'étape à laquelle elles appartiennent. Un test qui cliquerait
 * « Quantités » directement testerait un écran qui n'existe plus — et, pire,
 * cesserait de prouver ce que ce réarrangement doit prouver, c'est-à-dire que
 * chacune reste atteignable.
 *
 * En dessous de 1 100 px la barre est une liste déroulante ; au-dessus ce sont
 * sept boutons. Les deux répondent à la même demande.
 */
/**
 * Les bibliothèques ne sont pas des destinations.
 *
 * On ne « va » pas dans les matériaux : on les ouvre parce qu'un mur en
 * désigne un, ou on les cherche dans l'arborescence, avec le reste de ce qu'on
 * cherche. Elles ne sont donc plus en tête du panneau.
 */
const LIBRARIES: readonly string[] = [
  'Matériaux',
  'Assemblages',
  'Menuiseries',
  'Équipements',
];

const STAGE_OF: Readonly<Record<string, string>> = {
  Projet: 'Projet',
  'Niveaux et pièces': 'Projet',
  Plan: 'Bâtiment',
  Matériaux: 'Bâtiment',
  Assemblages: 'Bâtiment',
  Menuiseries: 'Bâtiment',
  Équipements: 'Aménagement',
  Réseaux: 'Systèmes',
  Calculs: 'Études',
  Quantités: 'Études',
  Scénarios: 'Études',
  Vérifications: 'Études',
  'Vues et feuilles': 'Documents',
};

export const DESTINATIONS = Object.keys(STAGE_OF);

/** Choisir l'étape, par ses boutons ou par sa liste déroulante. */
export async function openStage(page: Page, stage: string): Promise<void> {
  const bar = page.getByRole('navigation', { name: 'Étapes de création' });
  const entry = bar.getByRole('button', { name: stage, exact: true });
  if (await entry.isVisible()) {
    await entry.click();
    return;
  }
  await bar.getByLabel('Étape de création').selectOption({ label: stage });
}

export async function openDestination(
  page: Page,
  label: string,
): Promise<void> {
  const stage = STAGE_OF[label];
  if (stage === undefined)
    throw new Error(`Destination inconnue de la navigation : ${label}`);
  await openStage(page, stage);
  // On a narrow screen the context panel is a drawer; on a wide one it is
  // already there. Both have to answer the same request.
  const toggle = page.getByRole('button', { name: 'Panneau', exact: true });
  if (await toggle.isVisible()) await toggle.click();
  if (LIBRARIES.includes(label)) {
    const tree = page.getByRole('navigation', {
      name: 'Arborescence du projet',
    });
    // L'arborescence vit sur le plan : venir d'une autre bibliothèque veut
    // dire y revenir d'abord. Le panneau montre où l'on est, donc « Plan » est
    // là pour cela.
    if (!(await tree.isVisible()))
      await page
        .locator('#workspace-sidebar')
        .getByRole('button', { name: 'Plan', exact: true })
        .click();
    const entry = tree.getByRole('button', { name: label, exact: true });
    if (!(await entry.isVisible()))
      await tree
        .locator('summary')
        .filter({ hasText: 'Bibliothèques' })
        .click();
    // Choisir une bibliothèque referme le tiroir tout seul, sur un téléphone.
    await entry.click();
    return;
  }
  const entry = page
    .locator('#workspace-sidebar')
    .getByRole('button', { name: label, exact: true });
  // A stage holding one destination shows no list: entering it is arriving.
  if ((await entry.count()) > 0) await entry.click();
  else if (await toggle.isVisible()) await toggle.click();
}
