import type { Page } from '@playwright/test';

/**
 * Opening a destination, the way a person does it.
 *
 * The eleven destinations are no longer eleven buttons in one column: they are
 * reached through the space they belong to. A test that clicks « Quantités »
 * directly would be testing a screen that no longer exists — and, worse, would
 * stop proving the thing this rearrangement has to prove, which is that every
 * one of them is still reachable.
 */
const SPACE_OF: Readonly<Record<string, string>> = {
  Projet: 'Projet',
  Plan: 'Construire',
  'Niveaux et pièces': 'Construire',
  Matériaux: 'Construire',
  Assemblages: 'Construire',
  Équipements: 'Construire',
  Réseaux: 'Systèmes',
  Calculs: 'Analyser',
  Quantités: 'Analyser',
  Scénarios: 'Analyser',
  Vérifications: 'Analyser',
  'Vues et feuilles': 'Documents',
};

export const DESTINATIONS = Object.keys(SPACE_OF);

export async function openDestination(
  page: Page,
  label: string,
): Promise<void> {
  const space = SPACE_OF[label];
  if (space === undefined)
    throw new Error(`Destination inconnue de la navigation : ${label}`);
  await page
    .getByRole('navigation', { name: 'Espaces de travail' })
    .getByRole('button', { name: space, exact: true })
    .click();
  // On a narrow screen the context panel is a drawer; on a wide one it is
  // already there. Both have to answer the same request.
  const toggle = page.getByRole('button', { name: 'Panneau', exact: true });
  if (await toggle.isVisible()) await toggle.click();
  const entry = page
    .locator('#workspace-sidebar')
    .getByRole('button', { name: label, exact: true });
  // A space holding one destination shows no list: entering it is arriving.
  if ((await entry.count()) > 0) await entry.click();
  else if (await toggle.isVisible()) await toggle.click();
}
