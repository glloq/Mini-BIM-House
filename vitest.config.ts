import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: { reporter: ['text', 'json', 'html'] },
    include: ['{apps,packages,modules}/**/*.{test,spec}.{ts,tsx}'],
  },
});
