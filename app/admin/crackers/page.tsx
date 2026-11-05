import Link from 'next/link';
import CrackerPackForm from '@/components/admin/CrackerPackForm';
import { requireAdmin } from '@/lib/auth';
import { getCrackerPacks } from '@/lib/crackers';
import { getProducts } from '@/lib/products';

export const dynamic = 'force-dynamic';

export default async function CrackersAdminPage() {
  await requireAdmin();
  const [packs, products] = await Promise.all([getCrackerPacks(), getProducts()]);
  const flavors = products.filter((product) => product.category === 'cracker');

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Crackers</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        The pack sizes customers choose from. Each pack’s price is what a customer pays for it,
        whichever flavors they mix into it.
      </p>

      {packs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
          No packs yet. Run <code className="rounded bg-slate-100 px-1.5 py-0.5">npm run seed</code> to add the
          Discovery and Sharing packs.
        </p>
      ) : (
        <div className="space-y-4">
          {packs.map((pack) => (
            <CrackerPackForm key={pack.id} pack={pack} />
          ))}
        </div>
      )}

      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Flavors</h2>
        <p className="mt-1 text-sm text-slate-500">
          {flavors.length} flavor{flavors.length === 1 ? '' : 's'} on the menu:{' '}
          {flavors.map((flavor) => flavor.name).join(', ') || 'none yet'}. Add, rename, reorder or
          change their photos on the{' '}
          <Link href="/admin/products" className="font-medium text-slate-900 underline">
            Products
          </Link>{' '}
          page, under the category “Crackers”.
        </p>
      </div>
    </div>
  );
}
