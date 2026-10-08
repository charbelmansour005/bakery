'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Marks a paid order handed over to the customer, or undoes that. */
export default function FulfilButton({
  id,
  number,
  fulfilled,
}: {
  id: string;
  number: number;
  fulfilled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    const response = await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fulfilled: !fulfilled }),
    }).catch(() => null);

    if (!response?.ok) {
      window.alert(`Could not update order #${number}.`);
    } else {
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={
        fulfilled
          ? 'text-sm text-slate-500 transition hover:text-slate-900 hover:underline disabled:opacity-50'
          : 'rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50'
      }
    >
      {busy ? 'Saving…' : fulfilled ? 'Undo' : 'Mark done'}
    </button>
  );
}
