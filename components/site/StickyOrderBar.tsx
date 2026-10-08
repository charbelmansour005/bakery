'use client';

import { useState } from 'react';
import { useCart } from '@/lib/cart-context';
import { formatCents } from '@/lib/money';
import ReviewOrderDialog from './ReviewOrderDialog';

/**
 * A running summary of the cart. "Review Order" asks how the customer wants to
 * place it — pay through Whish, or cash on delivery — rather than deciding
 * for them.
 *
 * Every line carries its own loaf, so any cart here is an order the bakery can
 * fill — there is no half-built state to guard against before handing off.
 */
export default function StickyOrderBar({ paymentsEnabled = false }: { paymentsEnabled?: boolean }) {
  const { lines, isEmpty, totalCents, removeLine, clear, error } = useCart();
  const [reviewing, setReviewing] = useState(false);

  if (isEmpty) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gold/40 bg-cream-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-10">
          <div className="min-w-0">
            {error && (
              <p role="alert" className="mb-2 text-xs text-red-700">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
              <span className="eyebrow shrink-0 text-walnut-400">Your order</span>
              {lines.map((line) => {
                const label = line.addOn
                  ? `${line.addOn.name} · ${line.base.name}`
                  : `${line.base.name} · plain`;
                return (
                  <button
                    key={line.key}
                    type="button"
                    onClick={() => removeLine(line.key)}
                    aria-label={`Remove ${label}`}
                    className="group flex items-center gap-1.5 rounded-full border border-walnut/25 px-3 py-1 text-xs text-walnut transition hover:border-walnut hover:bg-walnut/5"
                  >
                    {label}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-3 w-3 text-walnut-400 transition group-hover:text-walnut"
                    >
                      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                    </svg>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={clear}
                className="text-xs text-walnut-400 underline underline-offset-4 transition hover:text-walnut"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-5 lg:justify-end">
            <p className="font-display text-lg text-walnut">
              Total <span className="ml-1 text-gold">{formatCents(totalCents)}</span>
            </p>
            <button
              type="button"
              onClick={() => setReviewing(true)}
              className="rounded-lg bg-gold px-6 py-3 text-sm font-semibold tracking-wide text-walnut transition hover:bg-gold-300"
            >
              Review Order
            </button>
          </div>
        </div>
      </div>

      <ReviewOrderDialog
        open={reviewing}
        onClose={() => setReviewing(false)}
        paymentsEnabled={paymentsEnabled}
      />
    </>
  );
}
