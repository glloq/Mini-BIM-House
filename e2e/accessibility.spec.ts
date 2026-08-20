import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * What an automated audit can check, checked on every workspace.
 *
 * A machine cannot tell whether an interface is usable; it can tell when a
 * field has no label, when a control is unreachable by keyboard, or when text
 * is unreadable against its background. Those are the failures this catches,
 * and they are failures, not warnings.
 */
const WORKSPACES = [
  'Projet',
  'Plan architectural',
  'Niveaux et pièces',
  'Matériaux',
  'Assemblages',
  'Équipements',
  'Réseaux',
  'Calculs',
  'Quantités',
  'Scénarios',
  'Vérifications',
] as const;

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
  await page.getByRole('button', { name: 'Maison de démonstration' }).click();
  await expect(page.getByRole('status')).toContainText('démonstration');

  for (const workspace of WORKSPACES) {
    await page.getByRole('button', { name: workspace, exact: true }).click();
    // The panel arrives on demand; auditing before it is there audits nothing.
    await expect(page.locator('.canvas-panel')).toBeVisible();
    const { violations } = await audit(page);
    expect(
      violations,
      `${workspace} :\n${describeViolations(violations)}`,
    ).toEqual([]);
  }
});

test('the command palette passes them too', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Maison de démonstration' }).click();
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
