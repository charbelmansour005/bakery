import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminApi } from '@/lib/auth';
import { deleteProduct, getProductById, updateProduct } from '@/lib/products';
import { productUpdateSchema } from '@/lib/validation';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PATCH(request: Request, { params }: Context) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = productUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid product.' },
      { status: 400 },
    );
  }

  try {
    const product = await updateProduct(id, parsed.data);
    if (!product) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

    revalidatePath('/');
    revalidatePath('/menu');
    return NextResponse.json({ product });
  } catch (err) {
    // Without this, a database error is an empty 500 and the CMS can only say
    // "could not save" — with nothing in the logs to say why.
    console.error('[products] could not update a product:', err instanceof Error ? `${err.name}: ${err.message}` : err);
    return NextResponse.json({ error: 'Could not save the product. Try again.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const deleted = await deleteProduct(id);
  if (!deleted) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  revalidatePath('/');
  revalidatePath('/menu');
  return NextResponse.json({ ok: true });
}
