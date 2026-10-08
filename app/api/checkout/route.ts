import { NextResponse } from 'next/server';
import { requireCustomerApi } from '@/lib/auth';
import { OrderError, createOrderFromCart } from '@/lib/orders';
import { checkoutSchema } from '@/lib/validation';

/**
 * Starts a payment for the signed-in customer's cart and returns the URL of
 * Whish's payment page for the browser to go to.
 */
export async function POST(request: Request) {
  const auth = await requireCustomerApi();
  if (!auth.ok) return auth.response;

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Check your details and try again.' },
      { status: 400 },
    );
  }

  try {
    const { orderId, url } = await createOrderFromCart(
      auth.session,
      parsed.data,
      new URL(request.url).origin,
    );
    return NextResponse.json({ orderId, url });
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[checkout] unexpected error:', err);
    return NextResponse.json({ error: 'Could not start the payment. Try again.' }, { status: 500 });
  }
}
