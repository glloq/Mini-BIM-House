import { describe, expect, it } from 'vitest';
import { BUDGETS, initialReferences } from './check-bundle-budget.mjs';

describe('bundle budget', () => {
  it('counts the page, its stylesheet and the modules it names', () => {
    const html = `<!doctype html><html><head>
<link rel="icon" href="data:image/svg+xml,<svg/>" />
<script type="module" crossorigin src="./assets/index-abc.js"></script>
<link rel="stylesheet" crossorigin href="./assets/index-def.css">
</head><body><div id="root"></div></body></html>`;
    expect(initialReferences(html)).toEqual([
      'assets/index-abc.js',
      'assets/index-def.css',
    ]);
  });

  it('states a budget rather than deriving one from what is built', () => {
    // A budget computed from the current build would always be met.
    expect(BUDGETS.initialGzipBytes).toBeGreaterThan(0);
    expect(BUDGETS.totalGzipBytes).toBeGreaterThan(BUDGETS.initialGzipBytes);
  });
});
