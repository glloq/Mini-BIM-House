import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));

/** The one place the application version is written down. */
const version: string = (
  JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  ) as { readonly version: string }
).version;

export default defineConfig({
  base: './',
  define: { __APPLICATION_VERSION__: JSON.stringify(version) },
  plugins: [react()],
  server: {
    // The demonstration project and its climate datasets are repository
    // fixtures shared with the tests rather than copies kept under apps/web.
    fs: { allow: [repositoryRoot] },
  },
});
