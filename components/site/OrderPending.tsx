'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/** How often, and for how long, to ask again while Whish has not confirmed. */
const INTERVAL_MS = 3000;
const MAX_CHECKS = 20;

/**
 * Shown while a payment is unconfirmed. Each refresh re-renders the order page
 * on the server, which asks Whish again; when the answer changes, this
 * component is simply no longer rendered.
 */
export default function OrderPending({ number, payUrl }: { number: number; payUrl: string }) {
  const router = useRouter();
  const [checks, setChecks] = useState(0);
  const waiting = checks < MAX_CHECKS;

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => {
      router.refresh();
      setChecks((count) => count + 1);
    }, INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [checks, waiting, router]);

  return (
    <div className="text-center">
      {waiting ? (
        <>
          <span
            className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold motion-reduce:animate-none"
            aria-hidden="true"
          />
          <h2 className="mt-5 font-display text-2xl text-walnut">Confirming your payment…</h2>
          <p role="status" className="mt-2 text-sm text-walnut-400">
            This usually takes a few seconds. You can stay on this page.
          </p>
        </>
      ) : (
        <>
          <h2 className="font-display text-2xl text-walnut">We have not seen a payment yet</h2>
          <p role="status" className="mt-2 text-sm text-walnut-400">
            Whish has not confirmed a payment for order #{number}. If you did pay, nothing is lost —
            check again in a moment.
          </p>
          <button
            type="button"
            onClick={() => setChecks(0)}
            className="mt-6 rounded-lg border border-walnut/30 px-6 py-3 text-sm font-semibold tracking-wide text-walnut transition hover:border-walnut hover:bg-walnut/5"
          >
            Check again
          </button>
        </>
      )}

      {payUrl && (
        <p className="mt-6 text-xs text-walnut-400">
          Did not finish paying?{' '}
          <a href={payUrl} className="underline underline-offset-4 transition hover:text-walnut">
            Go back to the Whish payment page
          </a>
        </p>
      )}
    </div>
  );
}
