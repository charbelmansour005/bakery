import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth';
import { setFulfilled } from '@/lib/orders';
import { orderFulfilSchema } from '@/lib/validation';

/** Admin only: mark a paid or cash order handed over, or undo that. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const parsed = orderFulfilSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { id } = await params;
  try {
    const order = await setFulfilled(id, parsed.data.fulfilled);
    if (!order) {
      return NextResponse.json({ error: 'That order cannot be marked done.' }, { status: 404 });
    }
    return NextResponse.json({ order });
  } catch {
    return NextResponse.json({ error: 'Could not update the order.' }, { status: 500 });
  }
}
