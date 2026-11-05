/**
 * The site as it will be, without touching live data:
 *
 *   npm run dev:preview
 *
 * Runs `next dev` against the test database (bakery_e2e), seeded with the full
 * menu — cracker flavors and packs included — and with Whish played by the
 * local mock, so checkout works end to end. Use it to try changes that need new
 * data before that data exists in the live database.
 *
 * The database address is handed to the child processes directly and never
 * printed: it contains the password.
 */
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.join(process.cwd(), '.env.local') });

import { spawn } from 'node:child_process';
import mongoose from 'mongoose';
import { seedCatalogue } from '../lib/seed-catalogue';
import { TEST_DATABASE, testDatabaseUri } from '../e2e/support/test-db';

const MOCK_PORT = process.env.E2E_MOCK_PORT ?? '4217';

async function main() {
  const uri = testDatabaseUri();
  await mongoose.connect(uri, { bufferCommands: false });
  if (mongoose.connection.db!.databaseName !== TEST_DATABASE) {
    throw new Error('Refusing to seed anything but the test database.');
  }
  const report = await seedCatalogue({
    adminUsername: process.env.ADMIN_USERNAME,
    adminPassword: process.env.ADMIN_PASSWORD,
  });
  await mongoose.disconnect();
  console.log(
    `Preview database ready (${TEST_DATABASE}): ${report.productsAdded} products and ${report.packsAdded} packs added.`,
  );

  const env = {
    ...process.env,
    MONGODB_URI: uri,
    WHISH_BASE_URL: `http://localhost:${MOCK_PORT}`,
    WHISH_CHANNEL: 'mock',
    WHISH_SECRET: 'mock',
    WHISH_WEBSITE_URL: 'localhost',
    WHISH_MODE: 'test',
    SITE_URL: '',
    WHISH_MOCK_PORT: MOCK_PORT,
  };

  const children = [
    spawn('npx', ['tsx', 'scripts/whish-mock.ts'], { env, stdio: 'inherit' }),
    spawn('npx', ['next', 'dev', ...(process.env.PORT ? ['-p', process.env.PORT] : [])], { env, stdio: 'inherit' }),
  ];
  const stop = () => children.forEach((child) => child.kill('SIGTERM'));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  children.forEach((child) => child.on('exit', (code) => {
    stop();
    process.exit(code ?? 0);
  }));
}

main().catch(async (err) => {
  console.error('Preview could not start:', err instanceof Error ? err.message : err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
