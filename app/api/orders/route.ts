import { NextResponse } from 'next/server';
import { requireCustomerApi } from '@/lib/auth';
import { OrderError, placeCashOrder } from '@/lib/orders';
import { cashOrderSchema } from '@/lib/validation';

/**
 * Places the signed-in customer's cart as a cash-on-delivery order, and returns
 * the WhatsApp link that hands it to the bakery.
 */
export async function POST(request: Request) {
  const auth = await requireCustomerApi();
  if (!auth.ok) return auth.response;

  const parsed = cashOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Check your details and try again.' },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await placeCashOrder(auth.session, parsed.data));
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[orders] could not place a cash order:', err);
    return NextResponse.json({ error: 'Could not place the order. Try again.' }, { status: 500 });
  }
}
