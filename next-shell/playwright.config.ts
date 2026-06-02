import { defineConfig } from '@playwright/test';

const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 300_000, // 5 minutes per test for human-speed mode
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3010',
    headless: false, // headed mode for visual observation
    launchOptions: {
      slowMo: 150, // human-like delay between every action (speed up from 800 to avoid E2E timeouts)
    },
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: skipWebServer ? undefined : {
    command: 'node scripts/playwright-webserver.cjs',
    url: 'http://127.0.0.1:3010',
    timeout: 120_000,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'human-speed',
      use: {
        headless: false,
        launchOptions: { slowMo: 150 },
      },
    },
    {
      name: 'api-only',
      use: {
        headless: true,
        launchOptions: { slowMo: 0 },
      },
      testMatch: /bulk-cost-calculation\.spec/,
    },
    {
      name: 'qa-smoke',
      use: {
        headless: true,
        launchOptions: { slowMo: 0 },
      },
      testMatch: /smoke\.spec/,
    },
  ],
});
