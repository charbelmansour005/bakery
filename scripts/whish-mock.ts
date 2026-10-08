/**
 * A local stand-in for Whish, for developing and testing the payment flow
 * without credentials or real money.
 *
 *   npm run whish:mock
 *
 * then start the site with:
 *
 *   WHISH_BASE_URL=http://localhost:4010 WHISH_CHANNEL=mock WHISH_SECRET=mock \
 *   WHISH_WEBSITE_URL=localhost npm run dev
 *
 * It speaks the same three calls lib/whish-api.ts makes, and serves a payment
 * page with buttons for each outcome worth testing — including the awkward
 * ones (a callback that never arrives, one that arrives twice, a decline
 * followed by a successful retry).
 *
 * This is a script, not a route: it is never part of the deployed site. State
 * is in memory and is lost when it stops.
 */
import http from 'node:http';

const PORT = Number(process.env.WHISH_MOCK_PORT ?? 4010);
const ORIGIN = `http://localhost:${PORT}`;

type Payment = {
  amount: number;
  currency: string;
  invoice: string;
  externalId: number;
  successCallbackUrl: string;
  failureCallbackUrl: string;
  successRedirectUrl: string;
  failureRedirectUrl: string;
  status: 'pending' | 'success' | 'failed';
};

const payments = new Map<number, Payment>();

const REQUIRED = [
  'amount',
  'currency',
  'invoice',
  'externalId',
  'successCallbackUrl',
  'failureCallbackUrl',
  'successRedirectUrl',
  'failureRedirectUrl',
] as const;

function json(res: http.ServerResponse, httpStatus: number, body: unknown) {
  res.writeHead(httpStatus, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const ok = (data: unknown) => ({ status: true, code: null, dialog: null, actions: null, extra: null, data });
const fail = (code: string, message: string) => ({
  status: false,
  code,
  dialog: { title: 'Error', message },
  actions: null,
  extra: null,
  data: null,
});

async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Whish calls the merchant's callback with a plain GET. */
async function fireCallback(url: string): Promise<void> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    console.log(`  callback → ${response.status} ${url.split('?')[0]}`);
  } catch (err) {
    console.log(`  callback → FAILED (${err instanceof Error ? err.message : err})`);
  }
}

function payPage(payment: Payment): string {
  const action = (name: string, label: string, hint: string) => `
    <a class="row" href="/pay/${payment.externalId}/act?do=${name}">
      <strong>${label}</strong><span>${hint}</span>
    </a>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mock Whish · ${payment.invoice}</title>
<style>
  body { font: 15px/1.5 system-ui, sans-serif; background: #f3f4f6; color: #111827; margin: 0; padding: 40px 16px; }
  main { max-width: 460px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 28px; box-shadow: 0 4px 24px rgb(0 0 0 / .08); }
  .tag { display: inline-block; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; }
  h1 { font-size: 30px; margin: 14px 0 2px; }
  p { margin: 0 0 20px; color: #6b7280; }
  .row { display: block; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; margin-top: 10px; text-decoration: none; color: inherit; }
  .row:hover { border-color: #111827; }
  .row strong { display: block; } .row span { color: #6b7280; font-size: 13px; }
</style></head>
<body><main>
  <span class="tag">MOCK WHISH — not a real payment</span>
  <h1>${payment.amount.toFixed(2)} ${payment.currency}</h1>
  <p>${payment.invoice} · externalId ${payment.externalId} · currently <b>${payment.status}</b></p>
  ${action('approve', 'Approve', 'Marks it paid, calls the success callback, sends the browser back.')}
  ${action('decline', 'Decline', 'Marks it failed, calls the failure callback, sends the browser back.')}
  ${action('approve-silent', 'Approve, but lose the callback', 'Paid, yet the callback never arrives. The return page must settle it.')}
  ${action('approve-twice', 'Approve, callback delivered twice', 'Two callbacks at once. The order must be fulfilled once.')}
  ${action('leave', 'Leave without paying', 'Nothing changes; the browser just goes back.')}
</main></body></html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', ORIGIN);
  const path = url.pathname.replace(/\/+$/, '');
  console.log(`${req.method} ${url.pathname}${url.search}`);

  /* ----- the customer-facing payment page ----- */

  const page = path.match(/^\/pay\/(\d+)$/);
  if (req.method === 'GET' && page) {
    const payment = payments.get(Number(page[1]));
    if (!payment) return json(res, 404, fail('not.found', 'No such payment.'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(payPage(payment));
  }

  const act = path.match(/^\/pay\/(\d+)\/act$/);
  if (req.method === 'GET' && act) {
    const payment = payments.get(Number(act[1]));
    if (!payment) return json(res, 404, fail('not.found', 'No such payment.'));

    const choice = url.searchParams.get('do');
    let redirect = payment.failureRedirectUrl;

    if (choice === 'approve' || choice === 'approve-silent' || choice === 'approve-twice') {
      payment.status = 'success';
      redirect = payment.successRedirectUrl;
      if (choice === 'approve') await fireCallback(payment.successCallbackUrl);
      if (choice === 'approve-twice') {
        await Promise.all([fireCallback(payment.successCallbackUrl), fireCallback(payment.successCallbackUrl)]);
      }
    } else if (choice === 'decline') {
      payment.status = 'failed';
      await fireCallback(payment.failureCallbackUrl);
    }

    res.writeHead(302, { Location: redirect });
    return res.end();
  }

  /* ----- the merchant API ----- */

  const { channel, secret, websiteurl } = req.headers;
  if (!channel || !secret || !websiteurl) {
    return json(res, 401, fail('auth', 'Missing channel, secret or websiteurl header.'));
  }

  if (req.method === 'GET' && path.endsWith('/payment/account/balance')) {
    return json(res, 200, ok({ balanceDetails: { balance: 0 } }));
  }

  if (req.method === 'POST' && path.endsWith('/payment/collect/status')) {
    const body = await readBody(req);
    const payment = payments.get(Number(body.externalId));
    if (!payment) return json(res, 400, fail('collect.not.found', 'No payment with that externalId.'));
    return json(
      res,
      200,
      ok({
        collectStatus: payment.status,
        payerPhoneNumber: payment.status === 'success' ? '96170902894' : null,
      }),
    );
  }

  if (req.method === 'POST' && path.endsWith('/payment/whish')) {
    const body = await readBody(req);

    const missing = REQUIRED.filter((field) => body[field] === undefined || body[field] === '');
    if (missing.length) return json(res, 400, fail('invalid', `Missing: ${missing.join(', ')}`));
    if (typeof body.amount !== 'number' || body.amount <= 0) {
      return json(res, 400, fail('invalid', 'amount must be a positive number.'));
    }
    if (typeof body.externalId !== 'number' || !Number.isInteger(body.externalId)) {
      return json(res, 400, fail('invalid', 'externalId must be an integer.'));
    }
    if (payments.has(body.externalId)) {
      return json(res, 400, fail('duplicate.external.id', 'externalId has already been used.'));
    }

    const payment = { ...(body as unknown as Omit<Payment, 'status'>), status: 'pending' as const };
    payments.set(payment.externalId, payment);
    return json(res, 200, ok({ collectUrl: `${ORIGIN}/pay/${payment.externalId}` }));
  }

  return json(res, 404, fail('not.found', `No mock for ${req.method} ${url.pathname}`));
});

server.listen(PORT, () => {
  console.log(`Mock Whish listening on ${ORIGIN}`);
  console.log(`Point the site at it with WHISH_BASE_URL=${ORIGIN}`);
});
