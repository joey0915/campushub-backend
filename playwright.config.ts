import { defineConfig, devices } from '@playwright/test';

/**
 * E2E suite for e2e/scenarios/reservation.feature. Playwright boots the whole
 * stack itself: the API on an in-memory MongoDB seeded with the demo catalogue
 * (e2e/support/api-server.ts) and the Vite client proxying /api to it.
 *
 * Both servers use dedicated ports and are never reused, so a developer's
 * running `npm run dev` stack, and its database, is never what gets tested.
 */
const API_PORT = 3100;
const CLIENT_PORT = 5174;
const API_ORIGIN = `http://localhost:${String(API_PORT)}`;
const CLIENT_ORIGIN = `http://localhost:${String(CLIENT_PORT)}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // Every browser books the same seeded resources and slots, so tests run one
  // at a time; each cancels its reservations on teardown to free the slot.
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: CLIENT_ORIGIN,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command: 'npx ts-node --project e2e/tsconfig.json e2e/support/api-server.ts',
      url: `${API_ORIGIN}/api/v1/health`,
      env: { PORT: String(API_PORT) },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm run dev --prefix client -- --port ${String(CLIENT_PORT)} --strictPort`,
      url: CLIENT_ORIGIN,
      env: { CAMPUSHUB_API_ORIGIN: API_ORIGIN },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
