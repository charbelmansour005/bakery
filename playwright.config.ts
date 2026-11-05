import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { testDatabaseUri } from './e2e/support/test-db';

// The tests talk to MongoDB and sign session cookies themselves, so they need
// the same values the dev server reads.
loadEnv({ path: path.join(__dirname, '.env.local') });

/**
 * End-to-end tests. They always run against a local dev server — never the
 * live site — and Whish is always the local mock (scripts/whish-mock.ts).
 *
 * The suite runs in two passes, because "is online payment on?" is decided by
 * the server's environment at start-up:
 *
 *   E2E_WHISH=off  the site as it is before credentials exist
 *   E2E_WHISH=on   payment switched on, pointed at the mock
 *
 * `npm run test:e2e` runs both. Stop `npm run dev` first: two dev servers
 * cannot share one .next folder.
 *
 * The server under test uses its own database (bakery_e2e, see
 * e2e/support/test-db.ts), wiped and seeded for every run.
 */
const whishOn = process.env.E2E_WHISH === 'on';
// Off the usual development ports (3000-3100), where another project's dev
// server is likely to be sitting. Override with E2E_PORT / E2E_MOCK_PORT.
const PORT = Number(process.env.E2E_PORT ?? 3217);
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT ?? 4217);
const NODE = 'source "$HOME/.nvm/nvm.sh" 2>/dev/null; nvm use 22 >/dev/null 2>&1;';

export default defineConfig({
  testDir: './e2e',
  // One database, one mock, one cart per customer: keep it sequential.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalSetup: './e2e/support/global-setup.ts',
  globalTeardown: './e2e/support/global-teardown.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: whishOn ? 'whish-on' : 'whish-off',
      // Files ending .on.spec.ts / .off.spec.ts belong to one pass; the rest run in both.
      testIgnore: whishOn ? /\.off\.spec\.ts$/ : /\.on\.spec\.ts$/,
      // The Chrome already installed on this machine, so there is no separate
      // browser download. Remove `channel` to use Playwright's own Chromium
      // (after `npx playwright install chromium`).
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: [
    ...(whishOn
      ? [
          {
            command: `${NODE} npm run whish:mock`,
            // Unauthenticated, so the mock answers 401 — which is all "up" needs.
            url: `http://localhost:${MOCK_PORT}/payment/account/balance`,
            reuseExistingServer: false,
            env: { WHISH_MOCK_PORT: String(MOCK_PORT) },
          },
        ]
      : []),
    {
      command: `${NODE} npx next dev -p ${PORT}`,
      url: `http://localhost:${PORT}/icon.svg`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: whishOn
        ? {
            MONGODB_URI: testDatabaseUri(),
            WHISH_BASE_URL: `http://localhost:${MOCK_PORT}`,
            WHISH_CHANNEL: 'mock',
            WHISH_SECRET: 'mock',
            WHISH_WEBSITE_URL: 'localhost',
            ORDER_NOTIFY_EMAIL: 'bakery@example.test',
            SITE_URL: '',
            WHISH_MODE: 'test',
          }
        : // Explicitly blank, in case .env.local has real credentials by now.
          {
            MONGODB_URI: testDatabaseUri(),
            WHISH_BASE_URL: '',
            WHISH_CHANNEL: '',
            WHISH_SECRET: '',
            WHISH_WEBSITE_URL: '',
            WHISH_MODE: '',
          },
    },
  ],
});
