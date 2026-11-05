'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DOLLARS_PATTERN, centsToDollars, dollarsToCents } from '@/lib/money';
import { CATEGORIES, CATEGORY_LABELS, type Category, type ProductDTO } from '@/types/product';
import ImageUploadField from './ImageUploadField';

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none';

export default function ProductForm({ product }: { product?: ProductDTO }) {
  const router = useRouter();
  const editing = Boolean(product);

  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState<Category>(product?.category ?? 'base');
  const [description, setDescription] = useState(product?.description ?? '');
  // Dollars are kept as a string so "4." and "4.0" stay typable; the conversion
  // to cents happens once, on submit.
  const [price, setPrice] = useState(product ? centsToDollars(product.price) : '');
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? '');
  const [sortOrder, setSortOrder] = useState(String(product?.sortOrder ?? 0));

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    // A cracker flavor has no price of its own: the pack it goes into does.
    const isCracker = category === 'cracker';
    if (!isCracker && !DOLLARS_PATTERN.test(price.trim())) {
      setError('Price must be a dollar amount, like 4 or 4.50.');
      return;
    }

    setBusy(true);

    const payload = {
      name: name.trim(),
      category,
      description: description.trim(),
      price: isCracker ? 0 : dollarsToCents(price.trim()),
      imageUrl: imageUrl.trim(),
      sortOrder: Number(sortOrder) || 0,
    };

    const response = await fetch(
      editing ? `/api/products/${product!.id}` : '/api/products',
      {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Could not save the product.');
      setBusy(false);
      return;
    }

    router.push('/admin/products');
    // Refresh so the list — and the public pages' router cache — pick up the change.
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700">
          Name
        </label>
        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={120}
          className={FIELD}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-slate-700">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(event) => setCategory(event.target.value as Category)}
            className={FIELD}
          >
            {CATEGORIES.map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        {category === 'cracker' ? (
          <div className="rounded-md border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-600">
            Cracker flavors have no price of their own — customers pay per pack. Set pack prices
            under{' '}
            <Link href="/admin/crackers" className="font-medium text-slate-900 underline">
              Crackers
            </Link>
            .
          </div>
        ) : (
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-slate-700">
            Price (USD)
          </label>
          <input
            id="price"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="4.50"
            required
            className={FIELD}
          />
          <p className="mt-1 text-xs text-slate-500">
            Stored as cents. Add-ons display with a leading “+”.
          </p>
        </div>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-700">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          maxLength={300}
          className={FIELD}
        />
      </div>

      <ImageUploadField value={imageUrl} onChange={setImageUrl} />

      <div>
        <label htmlFor="sortOrder" className="block text-sm font-medium text-slate-700">
          Sort order
        </label>
        <input
          id="sortOrder"
          inputMode="numeric"
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
          className={`${FIELD} max-w-32`}
        />
        <p className="mt-1 text-xs text-slate-500">Lower numbers appear first on the menu.</p>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 border-t border-slate-200 pt-5">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Create product'}
        </button>
        <Link
          href="/admin/products"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
