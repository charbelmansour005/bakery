'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useCart } from '@/lib/cart-context';
import { formatCents } from '@/lib/money';
import { useCashOrder } from '@/lib/use-cash-order';
import FleurDeLis from './FleurDeLis';
import { DeliveryMark, WhishLogo } from './PaymentMarks';

const OPTION =
  'flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-4 text-left transition';
/** A mark and the words beside it. */
const LABEL = 'flex items-center gap-3.5';

/**
 * "Review Order" opens this: the two ways to place the order, side by side —
 * pay online through Whish, or cash on delivery — which saves the order, sends
 * it to the bakery over WhatsApp, and is paid for in person.
 *
 * Until the Whish credentials are set, its option is shown but not offered:
 * marked "Coming soon", with nothing to press.
 *
 * A native <dialog> opened with showModal(): it renders in the browser's top
 * layer, so it is positioned against the viewport even when opened from inside
 * the order bar (whose backdrop blur would otherwise become the containing
 * block for anything fixed inside it), and it traps focus and closes on Escape
 * without any code here.
 */
export default function ReviewOrderDialog({
  open,
  onClose,
  paymentsEnabled,
}: {
  open: boolean;
  onClose: () => void;
  paymentsEnabled: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { lines, totalCents } = useCart();
  const { place, placing, error } = useCashOrder();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;

    // Stop the page behind scrolling under the dialog. SmoothScroll reads this
    // same style to know to stand down.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Fires for Escape and for close() alike, keeping the parent's state true.
      onClose={onClose}
      // The dialog element itself is only ever hit on its backdrop: the panel
      // inside covers the rest.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="review-order-title"
      className="mx-auto mt-auto mb-4 w-[calc(100%-2rem)] max-w-md rounded-xl bg-transparent p-0 text-walnut backdrop:bg-walnut/60 backdrop:backdrop-blur-sm sm:my-auto"
    >
      <div className="rounded-xl bg-cream-50 p-7 shadow-soft-lg sm:p-8">
        <div className="text-center">
          <FleurDeLis className="mx-auto h-6 w-6 text-gold" />
          <h2 id="review-order-title" className="mt-4 font-display text-2xl text-walnut">
            How would you like to order?
          </h2>
          <p className="mt-2 font-display text-base italic text-walnut-400">
            {lines.length} item{lines.length === 1 ? '' : 's'} · {formatCents(totalCents)}
          </p>
        </div>

        <div className="mt-7 space-y-3">
          {paymentsEnabled ? (
            <Link
              href="/cart"
              onClick={onClose}
              className={`${OPTION} border-gold bg-gold/10 hover:bg-gold/20`}
            >
              <span className={LABEL}>
                <WhishLogo />
                <span>
                  <span className="block text-sm font-semibold text-walnut">Pay with Whish</span>
                  <span className="mt-0.5 block text-xs text-walnut-400">
                    Choose your pickup day and pay online now.
                  </span>
                </span>
              </span>
              <Arrow />
            </Link>
          ) : (
            // Not a disabled button: there is nothing to press yet, so it is
            // plain text that reads as "this is coming", not as a broken control.
            // Stacked on a phone, where the tag would otherwise squeeze the text
            // into a column two words wide.
            <div className="flex w-full flex-col items-start gap-3 rounded-lg border border-dashed border-walnut/25 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <span className={LABEL}>
                <WhishLogo />
                <span>
                  <span className="block text-sm font-semibold text-walnut/60">Pay with Whish</span>
                  <span className="mt-0.5 block text-xs text-walnut-400">Pay online, right here.</span>
                </span>
              </span>
              <span className="eyebrow shrink-0 rounded-full bg-gold/20 px-3 py-1.5 text-walnut">
                Coming soon
              </span>
            </div>
          )}

          <button
            type="button"
            disabled={placing}
            onClick={async () => {
              if (await place()) onClose();
            }}
            className={`${OPTION} disabled:opacity-60 ${
              paymentsEnabled
                ? 'border-walnut/25 hover:border-walnut hover:bg-walnut/5'
                : 'border-gold bg-gold/10 hover:bg-gold/20'
            }`}
          >
            <span className={LABEL}>
              <DeliveryMark />
              <span>
                <span className="block text-sm font-semibold text-walnut">
                  {placing ? 'Placing your order…' : 'Cash on delivery'}
                </span>
                {/* Says where the tap goes: the label alone does not suggest that
                    WhatsApp is about to open. */}
                <span className="mt-0.5 block text-xs text-walnut-400">
                  Send your order on WhatsApp and pay in cash when you receive it.
                </span>
              </span>
            </span>
            <Arrow />
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg px-6 py-2.5 text-sm font-semibold tracking-wide text-walnut-400 transition hover:bg-walnut/5 hover:text-walnut"
        >
          Back to my order
        </button>
      </div>
    </dialog>
  );
}

function Arrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4 shrink-0 text-walnut-400"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
