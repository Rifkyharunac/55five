import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const chrome =
  process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = process.env.E2E_PORT || '3000';
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30000,
  expect: { timeout: 7000 },
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: existsSync(chrome) ? { executablePath: chrome } : {},
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    env: { PORT: port },
    reuseExistingServer: !process.env.CI,
  },
});
