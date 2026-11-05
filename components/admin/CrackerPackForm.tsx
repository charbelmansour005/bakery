'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DOLLARS_PATTERN, centsToDollars, dollarsToCents } from '@/lib/money';
import type { CrackerPackDTO } from '@/types/cracker';

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none';

/** One pack size, edited in place. */
export default function CrackerPackForm({ pack }: { pack: CrackerPackDTO }) {
  const router = useRouter();
  const [name, setName] = useState(pack.name);
  const [grams, setGrams] = useState(String(pack.grams));
  const [price, setPrice] = useState(centsToDollars(pack.price));
  const [maxFlavors, setMaxFlavors] = useState(String(pack.maxFlavors));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const id = (field: string) => `pack-${pack.id}-${field}`;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (!DOLLARS_PATTERN.test(price.trim())) {
      setError('Price must be a dollar amount, like 0.90 or 1.70.');
      return;
    }

    setBusy(true);
    const response = await fetch(`/api/cracker-packs/${pack.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        grams: Number(grams),
        price: dollarsToCents(price.trim()),
        maxFlavors: Number(maxFlavors),
      }),
    }).catch(() => null);

    if (!response?.ok) {
      const data = await response?.json().catch(() => ({}));
      setError(data?.error ?? 'Could not save the pack.');
      setBusy(false);
      return;
    }

    setSaved(true);
    setBusy(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <label htmlFor={id('name')} className="block text-sm font-medium text-slate-700">
            Name
          </label>
          <input id={id('name')} value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} className={FIELD} />
        </div>
        <div>
          <label htmlFor={id('grams')} className="block text-sm font-medium text-slate-700">
            Weight (g)
          </label>
          <input id={id('grams')} inputMode="numeric" value={grams} onChange={(e) => setGrams(e.target.value)} required className={FIELD} />
        </div>
        <div>
          <label htmlFor={id('price')} className="block text-sm font-medium text-slate-700">
            Price (USD)
          </label>
          <input id={id('price')} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required className={FIELD} />
        </div>
        <div>
          <label htmlFor={id('max')} className="block text-sm font-medium text-slate-700">
            Flavors per pack
          </label>
          <input id={id('max')} inputMode="numeric" value={maxFlavors} onChange={(e) => setMaxFlavors(e.target.value)} required className={FIELD} />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        {saved && !busy && (
          <p role="status" className="text-sm text-green-700">
            Saved — the site shows the new values.
          </p>
        )}
      </div>
    </form>
  );
}
