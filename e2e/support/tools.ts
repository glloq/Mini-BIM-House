import type { Page } from '@playwright/test';

/**
 * Choosing a tool, the way a person does it.
 *
 * There is no longer a « simple / expert » mode to switch: the common tools of
 * each trade are visible and the rest are one disclosure away, on the same
 * screen, for everyone. A test therefore opens the disclosure rather than
 * changing product.
 */
export async function revealAllTools(page: Page): Promise<void> {
  const panel = page.locator('.tools-panel');
  const disclosures = panel.locator(
    'details.tools-advanced:not([open]) summary',
  );
  for (let index = 0; index < (await disclosures.count()); index += 1)
    await disclosures.nth(index).click();
}

export async function chooseTool(page: Page, label: string): Promise<void> {
  await revealAllTools(page);
  await page
    .locator('.tools-panel')
    .getByRole('button', { name: label, exact: true })
    .click();
}
