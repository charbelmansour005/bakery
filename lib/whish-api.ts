/**
 * The Whish Money HTTP API, with no knowledge of this app.
 *
 * Kept free of `server-only` and of `process.env` on purpose: the app reaches
 * it through lib/whish.ts, and scripts/whish-check.ts imports it directly, so
 * the smoke test exercises exactly the request code production runs.
 *
 * Whish publishes no public reference. `payment/whish` is confirmed by a
 * working integration; the status and balance calls are built from secondary
 * sources and are the first thing `npm run whish:check` verifies. If Whish's
 * sandbox disagrees, the fix is in PATHS or readStatus() below and nowhere else.
 */

export const PATHS = {
  create: 'payment/whish',
  status: 'payment/collect/status',
  balance: 'payment/account/balance',
} as const;

const TIMEOUT_MS = 10_000;

export type WhishConfig = {
  /** API base, e.g. https://…/itel-service/api — not the marketing website. */
  baseUrl: string;
  channel: string;
  secret: string;
  /** The merchant domain registered with Whish. */
  websiteUrl: string;
};

export type WhishMode = 'test' | 'live';

/** Whish's own verdict on a payment. Anything unrecognised is `pending`. */
export type PaymentStatus = 'success' | 'failed' | 'pending';

export type CreatePaymentInput = {
  /** Integer cents. Converted to the decimal amount Whish expects. */
  amountCents: number;
  currency: 'USD' | 'LBP';
  invoice: string;
  /** Our reference. Numeric, and unique per payment attempt. */
  externalId: number;
  successCallbackUrl: string;
  failureCallbackUrl: string;
  successRedirectUrl: string;
  failureRedirectUrl: string;
};

/** A failure with a message that is safe to log. Never carries the secret. */
export class WhishError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number,
    /** The parsed response body, when there was one. */
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'WhishError';
  }
}

/** Sandbox and local stand-ins are test; everything else moves real money. */
export function modeOf(baseUrl: string): WhishMode {
  try {
    const { hostname } = new URL(baseUrl);
    if (hostname.includes('sandbox') || hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'test';
    }
    return 'live';
  } catch {
    return 'test';
  }
}

type Envelope = {
  status?: unknown;
  code?: unknown;
  dialog?: unknown;
  message?: unknown;
  data?: unknown;
};

/** `dialog` has been seen as a string and as { title, message }. */
function reasonFrom(envelope: Envelope | null): string | null {
  if (!envelope) return null;
  const { dialog, message, code } = envelope;
  if (typeof dialog === 'string' && dialog) return dialog;
  if (dialog && typeof dialog === 'object') {
    const { message: text, title } = dialog as { message?: unknown; title?: unknown };
    if (typeof text === 'string' && text) return text;
    if (typeof title === 'string' && title) return title;
  }
  if (typeof message === 'string' && message) return message;
  if (typeof code === 'string' && code) return code;
  return null;
}

/**
 * One request. Returns the whole parsed envelope so callers (and the smoke
 * test) can see exactly what Whish said.
 */
export async function whishRequest(
  config: WhishConfig,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<Envelope> {
  const url = `${config.baseUrl.replace(/\/+$/, '')}/${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        channel: config.channel,
        secret: config.secret,
        // Lowercase, as Whish expects it.
        websiteurl: config.websiteUrl,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    throw new WhishError(timedOut ? 'Whish did not respond in time.' : 'Could not reach Whish.');
  }

  const text = await response.text();
  let envelope: Envelope | null = null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object') envelope = parsed as Envelope;
  } catch {
    // Not JSON — typically an HTML 404 from pointing at the wrong host.
  }

  if (!response.ok || !envelope || envelope.status !== true) {
    const reason =
      reasonFrom(envelope) ??
      (envelope
        ? `Whish refused the request (HTTP ${response.status}).`
        : `Whish returned a non-JSON response (HTTP ${response.status}). Check WHISH_BASE_URL.`);
    throw new WhishError(reason, response.status, envelope ?? undefined);
  }

  return envelope;
}

/** The payment page URL, wherever in `data` Whish put it. */
function findPaymentUrl(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const candidates = [record.collectUrl, ...Object.values(record)];
  for (const value of candidates) {
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value;
  }
  return null;
}

/** Starts a payment and returns the URL of Whish's hosted payment page. */
export async function createPayment(
  config: WhishConfig,
  input: CreatePaymentInput,
): Promise<{ collectUrl: string; raw: unknown }> {
  const { amountCents, ...rest } = input;
  const envelope = await whishRequest(config, 'POST', PATHS.create, {
    // Whish takes a decimal in major units. toFixed first, so 1410 cents is
    // exactly 14.1 and never 14.100000000000001.
    amount: Number((amountCents / 100).toFixed(2)),
    ...rest,
  });

  const collectUrl = findPaymentUrl(envelope.data);
  if (!collectUrl) {
    throw new WhishError('Whish accepted the payment but returned no payment page.', 200, envelope);
  }
  return { collectUrl, raw: envelope };
}

/**
 * Deliberately strict: only the exact words Whish uses for a settled payment
 * count. A response we do not recognise is `pending`, so a change on Whish's
 * side can delay a confirmation but can never mark an unpaid order as paid.
 */
export function readStatus(data: unknown): { status: PaymentStatus; payerPhone: string } {
  const record = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const raw = String(record.collectStatus ?? '').trim().toLowerCase();
  const payerPhone = typeof record.payerPhoneNumber === 'string' ? record.payerPhoneNumber : '';

  if (raw === 'success') return { status: 'success', payerPhone };
  if (raw === 'failed') return { status: 'failed', payerPhone };
  return { status: 'pending', payerPhone };
}

/** Asks Whish what actually happened to a payment. This is the source of truth. */
export async function getPaymentStatus(
  config: WhishConfig,
  input: { currency: 'USD' | 'LBP'; externalId: number },
): Promise<{ status: PaymentStatus; payerPhone: string; raw: unknown }> {
  const envelope = await whishRequest(config, 'POST', PATHS.status, input);
  return { ...readStatus(envelope.data), raw: envelope };
}
