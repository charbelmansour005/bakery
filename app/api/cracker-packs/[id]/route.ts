import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminApi } from '@/lib/auth';
import { updateCrackerPack } from '@/lib/crackers';
import { crackerPackUpdateSchema } from '@/lib/validation';

/** Admin only: edit a pack's name, weight, price or flavor limit. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const parsed = crackerPackUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid pack.' },
      { status: 400 },
    );
  }

  const { id } = await params;
  try {
    const pack = await updateCrackerPack(id, parsed.data);
    if (!pack) return NextResponse.json({ error: 'No such pack.' }, { status: 404 });
    revalidatePath('/');
    revalidatePath('/menu');
    return NextResponse.json({ pack });
  } catch {
    return NextResponse.json({ error: 'Could not save the pack.' }, { status: 500 });
  }
}
