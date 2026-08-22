import { defineConfig } from 'vitest/config';

/**
 * The one test that mutates the repository while it runs.
 *
 * It writes a catalogue file nothing has ever been told about, asks the real
 * pipeline whether it finds it, and removes it. That is the only honest way to
 * check « adding fiches requires no change to any TypeScript file » — and it
 * is also why it cannot run beside the suites that count the entries of that
 * same catalogue, which would see nineteen or twenty depending on the
 * scheduler.
 *
 * So it runs alone, here.
 */
export default defineConfig({
  test: { include: ['scripts/catalog-discovery.test.mjs'] },
});
