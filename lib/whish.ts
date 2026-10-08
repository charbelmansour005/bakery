import 'server-only';
import {
  createPayment as createPaymentWith,
  getPaymentStatus as getPaymentStatusWith,
  modeOf,
  type CreatePaymentInput,
  type PaymentStatus,
  type WhishConfig,
  type WhishMode,
} from './whish-api';

/**
 * This app's Whish account: reads the credentials from the environment and
 * binds them to the calls in lib/whish-api.ts.
 *
 * Sandbox and live differ only by these four values. With any of them missing,
 * online payment is simply off — the site falls back to WhatsApp ordering — so
 * this can be deployed before the credentials exist.
 */

function readConfig(): WhishConfig | null {
  const baseUrl = process.env.WHISH_BASE_URL?.trim();
  const channel = process.env.WHISH_CHANNEL?.trim();
  const secret = process.env.WHISH_SECRET?.trim();
  const websiteUrl = process.env.WHISH_WEBSITE_URL?.trim();

  if (!baseUrl || !channel || !secret || !websiteUrl) return null;
  return { baseUrl, channel, secret, websiteUrl };
}

function requireConfig(): WhishConfig {
  const config = readConfig();
  if (!config) {
    throw new Error(
      'Whish is not configured. Set WHISH_BASE_URL, WHISH_CHANNEL, WHISH_SECRET and WHISH_WEBSITE_URL.',
    );
  }
  return config;
}

export function isWhishConfigured(): boolean {
  return readConfig() !== null;
}

/** `live` when unconfigured, so nothing is ever mistaken for a test order by default. */
export function whishMode(): WhishMode {
  const config = readConfig();
  return config ? modeOf(config.baseUrl) : 'live';
}

export async function createPayment(input: CreatePaymentInput): Promise<string> {
  const { collectUrl } = await createPaymentWith(requireConfig(), input);
  return collectUrl;
}

export async function getPaymentStatus(
  externalId: number,
): Promise<{ status: PaymentStatus; payerPhone: string }> {
  const { status, payerPhone } = await getPaymentStatusWith(requireConfig(), {
    currency: 'USD',
    externalId,
  });
  return { status, payerPhone };
}

export { WhishError } from './whish-api';
export type { PaymentStatus, WhishMode };
