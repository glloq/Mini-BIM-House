import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests run against the production build, so what is exercised is what
 * GitHub Pages will serve rather than a development bundle.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI === undefined ? 0 : 1,
  // Continuous integration keeps a single worker so the shared preview
  // server and the page timings stay predictable; locally Playwright decides.
  ...(process.env.CI === undefined ? {} : { workers: 1 }),
  reporter:
    process.env.CI === undefined
      ? 'list'
      : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /mobile\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Continuous integration downloads the browser Playwright expects; a
        // sandbox that already ships one points at it instead of re-downloading.
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE === undefined
          ? {}
          : {
              launchOptions: {
                executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
              },
            }),
      },
    },
    {
      // A phone is not a narrow desktop: the tests tagged @mobile check that
      // the workspace stays reachable on one.
      name: 'mobile',
      testMatch: /mobile\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE === undefined
          ? {}
          : {
              launchOptions: {
                executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
              },
            }),
      },
    },
  ],
  webServer: {
    command: 'npm run preview --workspace=@house-technical-designer/web',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: process.env.CI === undefined,
    timeout: 120_000,
  },
});
