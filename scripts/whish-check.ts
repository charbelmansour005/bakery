/**
 * Smoke test for the Whish credentials in .env.local.
 *
 *   npm run whish:check            # opens a 1.00 USD payment
 *   npm run whish:check -- 2.50    # or another amount
 *
 * Run this first whenever the credentials or the base URL change. It makes the
 * same calls the site makes, through the same code (lib/whish-api.ts), and
 * prints exactly what Whish answers:
 *
 *   1. balance          — do the credentials work at all?
 *   2. create payment   — do we get a payment page back?
 *   3. payment status   — can we ask Whish what happened? (the site depends on it)
 *
 * It opens a real payment request but pays nothing; an unpaid request simply
 * lapses. The secret is never printed.
 */
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.join(process.cwd(), '.env.local') });

import {
  PATHS,
  WhishError,
  createPayment,
  getPaymentStatus,
  modeOf,
  whishRequest,
  type WhishConfig,
} from '../lib/whish-api';

function show(label: string, value: unknown) {
  console.log(`${label}\n${JSON.stringify(value, null, 2)}\n`);
}

function explain(err: unknown): string {
  if (err instanceof WhishError) {
    const body = err.body === undefined ? '' : `\n${JSON.stringify(err.body, null, 2)}`;
    return `${err.message}${err.httpStatus ? ` (HTTP ${err.httpStatus})` : ''}${body}`;
  }
  return err instanceof Error ? err.message : String(err);
}

async function main() {
  const env = {
    WHISH_BASE_URL: process.env.WHISH_BASE_URL?.trim(),
    WHISH_CHANNEL: process.env.WHISH_CHANNEL?.trim(),
    WHISH_SECRET: process.env.WHISH_SECRET?.trim(),
    WHISH_WEBSITE_URL: process.env.WHISH_WEBSITE_URL?.trim(),
  };
  const missing = Object.entries(env)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length) {
    throw new Error(`Missing in .env.local: ${missing.join(', ')}`);
  }

  const whish: WhishConfig = {
    baseUrl: env.WHISH_BASE_URL!,
    channel: env.WHISH_CHANNEL!,
    secret: env.WHISH_SECRET!,
    websiteUrl: env.WHISH_WEBSITE_URL!,
  };

  const amount = Number(process.argv[2] ?? '1');
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number, e.g. npm run whish:check -- 2.50');
  }

  const site = (process.env.SITE_URL?.trim() || 'https://www.labellefournee.com').replace(/\/+$/, '');

  console.log('Whish smoke test');
  console.log(`  base URL     ${whish.baseUrl}`);
  console.log(`  mode         ${modeOf(whish.baseUrl)}`);
  console.log(`  website URL  ${whish.websiteUrl}`);
  console.log(`  channel      set (${whish.channel.length} characters)`);
  console.log(`  secret       set (${whish.secret.length} characters)`);
  console.log(`  site         ${site}\n`);

  const results: Record<string, boolean> = {};

  // 1. Balance. The method is not documented, so try GET, then POST.
  try {
    let balance;
    try {
      balance = await whishRequest(whish, 'GET', PATHS.balance);
    } catch {
      balance = await whishRequest(whish, 'POST', PATHS.balance, {});
    }
    show(`1. Balance (${PATHS.balance})`, balance);
    results.balance = true;
  } catch (err) {
    console.log(`1. Balance (${PATHS.balance}) FAILED\n${explain(err)}\n`);
    results.balance = false;
  }

  // 2. Create a payment. Date.now() is numeric and never repeats.
  const externalId = Date.now();
  try {
    const { collectUrl, raw } = await createPayment(whish, {
      amountCents: Math.round(amount * 100),
      currency: 'USD',
      invoice: `Smoke test ${externalId}`,
      externalId,
      // Not a real order, so the site answers these with a harmless 404.
      successCallbackUrl: `${site}/api/whish/callback?order=whish-check&result=success`,
      failureCallbackUrl: `${site}/api/whish/callback?order=whish-check&result=failure`,
      successRedirectUrl: `${site}/cart`,
      failureRedirectUrl: `${site}/cart`,
    });
    show(`2. Create payment (${PATHS.create}), externalId ${externalId}`, raw);
    console.log(`   Payment page: ${collectUrl}\n`);
    results.create = true;
  } catch (err) {
    console.log(`2. Create payment (${PATHS.create}) FAILED\n${explain(err)}\n`);
    results.create = false;
  }

  // 3. Status of the payment just created. Unpaid, so `pending` is the right answer.
  if (results.create) {
    try {
      const { status, raw } = await getPaymentStatus(whish, { currency: 'USD', externalId });
      show(`3. Payment status (${PATHS.status})`, raw);
      console.log(`   The site reads this as: ${status} (expected: pending)\n`);
      results.status = true;
    } catch (err) {
      console.log(`3. Payment status (${PATHS.status}) FAILED\n${explain(err)}\n`);
      results.status = false;
    }
  } else {
    console.log('3. Payment status skipped — no payment was created.\n');
    results.status = false;
  }

  console.log('Summary');
  console.log(`  balance         ${results.balance ? 'ok' : 'FAILED (not used by the site)'}`);
  console.log(`  create payment  ${results.create ? 'ok' : 'FAILED'}`);
  console.log(`  payment status  ${results.status ? 'ok' : 'FAILED'}`);

  if (!results.create || !results.status) {
    console.log('\nThe site needs both "create payment" and "payment status" to take payments.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`\nWhish check could not run: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
