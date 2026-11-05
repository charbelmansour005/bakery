import Link from 'next/link';
import DeleteProductButton from '@/components/admin/DeleteProductButton';
import { requireAdmin } from '@/lib/auth';
import { formatCents } from '@/lib/money';
import { getProducts } from '@/lib/products';
import { CATEGORY_LABELS } from '@/types/product';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  await requireAdmin();
  const products = await getProducts();

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-500">
            {products.length} item{products.length === 1 ? '' : 's'} on the public menu.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Add Product
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {products.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">
            No products yet. Run <code className="rounded bg-slate-100 px-1.5 py-0.5">npm run seed</code>{' '}
            or add one above.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Image</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="h-12 w-12 overflow-hidden rounded border border-slate-200 bg-slate-50">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{product.name}</p>
                    <p className="max-w-xs truncate text-xs text-slate-500">{product.description}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {CATEGORY_LABELS[product.category]}
                  </td>
                  <td className="px-4 py-3 text-slate-900">
                    {product.category === 'cracker' ? (
                      <span className="text-slate-400" title="Priced per pack, under Crackers">
                        per pack
                      </span>
                    ) : (
                      formatCents(product.price, { signed: product.category !== 'base' })
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-4">
                      <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="text-sm text-slate-700 transition hover:text-slate-900 hover:underline"
                      >
                        Edit
                      </Link>
                      <DeleteProductButton id={product.id} name={product.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
