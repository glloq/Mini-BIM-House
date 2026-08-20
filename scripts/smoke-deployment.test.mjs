import { describe, expect, it } from 'vitest';
import {
  looksLikeApplication,
  referencedAssets,
  typeIssue,
} from './smoke-deployment.mjs';

const page = `<!doctype html><html><head>
<link rel="icon" href="data:image/svg+xml,<svg/>" />
<script type="module" crossorigin src="./assets/index-abc.js"></script>
<link rel="stylesheet" crossorigin href="./assets/index-def.css">
</head><body><div id="root"></div></body></html>`;

describe('deployment smoke check', () => {
  it('names every file the page needs, and nothing inline', () => {
    expect(referencedAssets(page)).toEqual([
      './assets/index-abc.js',
      './assets/index-def.css',
    ]);
  });

  it('tells the application apart from a listing or an error page', () => {
    expect(looksLikeApplication(page)).toBe(true);
    expect(looksLikeApplication('<html><body>404</body></html>')).toBe(false);
    // A page with the root element but no script never starts.
    expect(looksLikeApplication('<div id="root"></div>')).toBe(false);
  });

  it('refuses an asset served as the fallback page', () => {
    // The failure this exists for: a host answering unknown paths with
    // index.html returns 200 for a script that is not there.
    expect(
      typeIssue('https://example.org/assets/index-abc.js', 'text/html'),
    ).toContain('au lieu de text/javascript');
    expect(
      typeIssue(
        'https://example.org/assets/index-abc.js',
        'text/javascript; charset=utf-8',
      ),
    ).toBeUndefined();
    expect(
      typeIssue('https://example.org/assets/index-def.css', 'text/css'),
    ).toBeUndefined();
    // Nothing is claimed about a type the check does not know.
    expect(
      typeIssue('https://example.org/logo.png', 'image/png'),
    ).toBeUndefined();
  });
});
