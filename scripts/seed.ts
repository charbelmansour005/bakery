/**
 * Adds the starting menu, the cracker packs and the admin user.
 *
 * Run with `npm run seed`. Safe to re-run: products and packs are added only if
 * missing, so it never touches a price, photo or description edited in the CMS.
 * It does reset the admin password to whatever ADMIN_PASSWORD currently holds.
 *
 * `tsx` does not read .env.local — that is a Next.js feature, not a Node one —
 * so we load it explicitly or MONGODB_URI would be undefined and the connection
 * would fall back to localhost with a confusing ECONNREFUSED.
 */
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.join(process.cwd(), '.env.local') });

import mongoose from 'mongoose';
import { seedCatalogue } from '../lib/seed-catalogue';

async function main() {
  const uri = process.env.MONGODB_URI;
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  const missing = [
    !uri && 'MONGODB_URI',
    !username && 'ADMIN_USERNAME',
    !password && 'ADMIN_PASSWORD',
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`Missing env ${missing.join(', ')}. Copy .env.example to .env.local.`);
  }

  console.log('Connecting to MongoDB…');
  await mongoose.connect(uri!, { bufferCommands: false });

  const report = await seedCatalogue({ adminUsername: username, adminPassword: password });
  console.log(`Products: ${report.productsAdded} added; anything already there was left untouched.`);
  console.log(`Cracker packs: ${report.packsAdded} added; anything already there was left untouched.`);
  console.log(report.storyAdded ? 'Our Story: seeded the default photographs.' : 'Our Story: already set, left untouched.');
  console.log(`Admin "${report.admin}" is ready. Sign in at /admin/login.`);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(async (err) => {
  console.error('\nSeed failed:', err instanceof Error ? err.message : err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
