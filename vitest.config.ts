import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

/**
 * The application version reaches the tests the same way it reaches the build:
 * read from the repository's `package.json`, never retyped.
 */
const version: string = (
  JSON.parse(
    readFileSync(new URL('package.json', import.meta.url), 'utf8'),
  ) as {
    readonly version: string;
  }
).version;

export default defineConfig({
  define: { __APPLICATION_VERSION__: JSON.stringify(version) },
  test: {
    coverage: { reporter: ['text', 'json', 'html'] },
    include: [
      '{apps,packages,modules}/**/*.{test,spec}.{ts,tsx}',
      'scripts/**/*.test.mjs',
    ],
  },
});
