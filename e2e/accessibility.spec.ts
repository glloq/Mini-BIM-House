import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { fileAction } from './support/file-menu.js';

import {
  DESTINATIONS,
  openDestination,
  workspaceReady,
} from './support/navigation.js';

/**
 * What an automated audit can check, checked on every workspace.
 *
 * A machine cannot tell whether an interface is usable; it can tell when a
 * field has no label, when a control is unreachable by keyboard, or when text
 * is unreadable against its background. Those are the failures this catches,
 * and they are failures, not warnings.
 */

async function audit(page: Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
}

function describeViolations(
  violations: Awaited<ReturnType<typeof audit>>['violations'],
): string {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact ?? 'sans impact déclaré'}) : ${violation.help}\n` +
        violation.nodes
          .slice(0, 3)
          .map((node) => `    ${node.target.join(' ')}`)
          .join('\n'),
    )
    .join('\n');
}

test('every workspace passes the automated accessibility rules', async ({
  page,
}) => {
  await page.goto('/');
  await fileAction(page, 'Maison de démonstration');
  await expect(page.getByRole('status')).toContainText('démonstration');

  for (const destination of DESTINATIONS) {
    await openDestination(page, destination);
    /*
     * The panel arrives on demand; auditing before it is there audits nothing.
     *
     * Et c'est très exactement ce qui se passait. `.canvas-panel` est rendue
     * tout de suite, avec « Chargement de l'espace de travail… » dedans :
     * l'attendre visible n'attend rien. Sur onze destinations sur treize, cet
     * audit analysait la phrase d'attente et déclarait treize espaces
     * conformes.
     */
    await workspaceReady(page);
    const { violations } = await audit(page);
    expect(
      violations,
      `${destination} :\n${describeViolations(violations)}`,
    ).toEqual([]);
  }
});

test('the command palette passes them too', async ({ page }) => {
  await page.goto('/');
  await fileAction(page, 'Maison de démonstration');
  await expect(page.getByRole('status')).toContainText('démonstration');
  // A panel only opened on demand is never seen by the audit of the
  // workspaces, and it is the one control that reaches all of them.
  await page.locator('.plan-canvas').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+k');
  await expect(
    page.getByRole('dialog', { name: 'Palette de commandes' }),
  ).toBeVisible();
  const { violations } = await audit(page);
  expect(violations, describeViolations(violations)).toEqual([]);
});
