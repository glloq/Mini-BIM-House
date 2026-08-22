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
    coverage: {
      reporter: ['text', 'json', 'html'],
      provider: 'v8',
      // What the whole house rests on. A hundred per cent everywhere would be
      // a number to chase; a floor under the packages that decide what a
      // project *is* is a promise worth keeping, and a fall through it is a
      // regression worth stopping.
      include: [
        'packages/geometry/src/**/*.ts',
        'packages/core-domain/src/**/*.ts',
        'packages/project-io/src/**/*.ts',
        'packages/editor-core/src/**/*.ts',
        'packages/calculation-adapters/src/**/*.ts',
        'packages/catalog-registry/src/**/*.ts',
        'packages/technical-types/src/**/*.ts',
        'packages/climate/src/**/*.ts',
      ],
      // Type-only modules and generated declarations have no branches to
      // cover; counting them would move the figure without moving the truth.
      exclude: [
        '**/*.{test,spec,bench}.ts',
        '**/*.d.ts',
        '**/index.ts',
        '**/types.ts',
      ],
      // Set just under what the suite reaches today. A threshold above the
      // truth is a threshold somebody turns off; this one locks in what exists
      // and refuses a step backwards.
      thresholds: { statements: 90, branches: 77, functions: 95, lines: 90 },
    },
    include: [
      '{apps,packages,modules}/**/*.{test,spec}.{ts,tsx}',
      'scripts/**/*.test.mjs',
    ],
    /**
     * The discovery test writes a real catalogue file into the repository and
     * removes it again, because that is the only way to ask whether the
     * pipeline finds a file it was never told about. It therefore cannot run
     * beside suites that count the entries of that same catalogue: they would
     * see nineteen or twenty depending on the scheduler.
     *
     * `npm run test:discovery` runs it alone, and the integration runs that.
     */
    exclude: ['**/node_modules/**', 'scripts/catalog-discovery.test.mjs'],
  },
});
