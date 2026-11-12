import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminApi } from '@/lib/auth';
import { createProduct, getProducts } from '@/lib/products';
import { productCreateSchema } from '@/lib/validation';

/** Public: used by anything that wants the live menu over HTTP. */
export async function GET() {
  try {
    const products = await getProducts();
    return NextResponse.json({ products });
  } catch {
    return NextResponse.json({ error: 'Could not load products.' }, { status: 500 });
  }
}

/** Admin only. */
export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const parsed = productCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid product.' },
      { status: 400 },
    );
  }

  try {
    const product = await createProduct(parsed.data);
    revalidatePath('/');
    revalidatePath('/menu');
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    console.error('[products] could not create a product:', err instanceof Error ? `${err.name}: ${err.message}` : err);
    return NextResponse.json({ error: 'Could not create the product. Try again.' }, { status: 500 });
  }
}
