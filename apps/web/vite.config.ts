import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    // The demonstration project and its climate datasets are repository
    // fixtures shared with the tests rather than copies kept under apps/web.
    fs: { allow: [repositoryRoot] },
  },
});
