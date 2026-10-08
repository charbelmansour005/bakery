import { NextResponse } from 'next/server';
import { isCallbackForOrder, settleOrder } from '@/lib/orders';

export const dynamic = 'force-dynamic';
// Room for the status rechecks below, and for a slow answer from Whish.
export const maxDuration = 30;

/**
 * Whish calls this, server to server, when a payment succeeds or fails.
 *
 * The request is unsigned, so nothing in it is believed — not even the
 * `result` it carries. All it does is prompt settleOrder() to ask Whish
 * directly what happened to that order. Calling this by hand achieves nothing
 * Whish has not already confirmed.
 */

/** Extra status checks when Whish announces a success its status call does not show yet. */
const RECHECKS = 2;
const RECHECK_DELAY_MS = 1500;

async function handle(request: Request) {
  const params = new URL(request.url).searchParams;
  const orderId = params.get('order') ?? '';
  const token = params.get('t') ?? '';
  const announcedSuccess = params.get('result') === 'success';

  try {
    if (!(await isCallbackForOrder(orderId, token))) {
      return NextResponse.json({ error: 'Unknown order.' }, { status: 404 });
    }

    let order = await settleOrder(orderId);

    // `result` is only a hint, used for patience and never for trust: if Whish
    // says "success" here but its status call is a beat behind, ask again
    // rather than leave a paid order waiting on the customer's browser.
    for (let attempt = 0; announcedSuccess && order?.status !== 'paid' && attempt < RECHECKS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, RECHECK_DELAY_MS));
      order = await settleOrder(orderId);
    }

    if (announcedSuccess && order?.status !== 'paid') {
      // Not an error we can fix now; a non-2xx invites Whish to call again.
      return NextResponse.json({ error: 'Payment not confirmed yet.' }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    // A 5xx invites Whish to try again; the customer's return also settles it.
    console.error('[whish] callback failed:', err);
    return NextResponse.json({ error: 'Could not process the callback.' }, { status: 500 });
  }
}

// Whish uses GET. POST is accepted too, since the method is not documented.
export { handle as GET, handle as POST };
