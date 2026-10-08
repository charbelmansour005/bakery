'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useCart } from '@/lib/cart-context';
import { formatCents } from '@/lib/money';
import { formatPickupDate, type PickupWindow } from '@/lib/pickup';
import { useSignOut } from '@/lib/use-sign-out';
import { buildOrderMessage, whatsappUrl } from '@/lib/whatsapp';
import { DeliveryIcon, WhishLogo } from './PaymentMarks';
import ReviewOrderDialog from './ReviewOrderDialog';

const FIELD =
  'mt-2 w-full rounded-lg border border-walnut/20 bg-cream-50 px-4 py-3 text-sm text-walnut placeholder:text-walnut-400/70 focus:border-gold focus:ring-2 focus:ring-gold/40 focus:outline-none';

const PRIMARY =
  'rounded-lg bg-gold px-6 py-3 text-center text-sm font-semibold tracking-wide text-walnut transition hover:bg-gold-300 disabled:opacity-50';
const SECONDARY =
  'rounded-lg border border-walnut/30 px-6 py-3 text-center text-sm font-semibold tracking-wide text-walnut transition hover:border-walnut hover:bg-walnut/5';

/**
 * The full order, read from the live cart context so a removal shows at once
 * rather than after a server round trip.
 *
 * With online payment on, this is also the checkout: the customer says when
 * they will collect and pays through Whish, or chooses cash on delivery, which
 * sends the same order over WhatsApp. With it off, "Review Order" opens the same two
 * choices as the order bar does, with Whish marked as coming soon.
 */
export default function CartView({
  email,
  paymentsEnabled,
  pickup,
  lastPhone,
}: {
  email: string;
  paymentsEnabled: boolean;
  pickup: PickupWindow;
  lastPhone: string;
}) {
  const router = useRouter();
  const { lines, isEmpty, totalCents, removeLine, refresh, pending, error } = useCart();
  const { signOut, busy: signingOut } = useSignOut();

  const [phone, setPhone] = useState(lastPhone);
  const [pickupDate, setPickupDate] = useState(pickup.min);
  const [note, setNote] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  async function handlePay(event: React.FormEvent) {
    event.preventDefault();
    setPaying(true);
    setPayError(null);

    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // The total is sent only so the server can refuse if it no longer
      // matches — the amount charged is always the server's own.
      body: JSON.stringify({ phone, pickupDate, note, expectedTotalCents: totalCents }),
    }).catch(() => null);

    if (!response) {
      setPayError('Could not reach the server. Check your connection.');
      setPaying(false);
      return;
    }

    const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };

    if (!response.ok || !data.url) {
      if (response.status === 401) {
        router.push('/account/login?from=/cart');
        return;
      }
      // The cart moved under us: show the customer what it holds now.
      if (response.status === 409) await refresh();
      setPayError(data.error ?? 'Could not start the payment. Try again.');
      setPaying(false);
      return;
    }

    // Leave `paying` on: the page is about to be replaced by Whish's.
    window.location.assign(data.url);
  }

  return (
    <>
      <div className="rounded-xl bg-cream-50 p-7 shadow-soft">
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        {isEmpty ? (
          <>
            <p className="font-display text-lg italic text-walnut-400">Nothing in your order yet.</p>
            <Link href="/menu" className={`mt-6 inline-block ${PRIMARY}`}>
              Browse the menu
            </Link>
          </>
        ) : (
          <>
            <ul className="divide-y divide-cream-200">
              {lines.map((line) => (
                <li key={line.key} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="font-display text-lg text-walnut">
                      {line.addOn ? `${line.addOn.name} on ${line.base.name}` : `${line.base.name}, plain`}
                    </p>
                    <p className="text-xs text-walnut-400">
                      {line.addOn
                        ? `${line.addOn.name} ${formatCents(line.addOn.price)} + ${line.base.name} ${formatCents(line.base.price, { compact: true })}`
                        : `${line.base.name} ${formatCents(line.base.price, { compact: true })}`}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-display text-lg text-gold">{formatCents(line.totalCents)}</span>
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      aria-label={`Remove ${line.addOn ? `${line.addOn.name} on ${line.base.name}` : `plain ${line.base.name}`}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-walnut-400 transition hover:bg-walnut/5 hover:text-walnut"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-2 flex items-baseline justify-between border-t border-walnut/15 pt-4">
              <span className="eyebrow text-walnut-400">Total</span>
              <span className="font-display text-2xl text-walnut">{formatCents(totalCents)}</span>
            </div>

            {paymentsEnabled ? (
              <form onSubmit={handlePay} className="mt-8 border-t border-walnut/15 pt-7">
                <h2 className="font-display text-2xl text-walnut">Pickup details</h2>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="checkout-pickup" className="eyebrow text-walnut-400">
                      Pickup day
                    </label>
                    <input
                      id="checkout-pickup"
                      type="date"
                      value={pickupDate}
                      min={pickup.min}
                      max={pickup.max}
                      onChange={(event) => setPickupDate(event.target.value)}
                      required
                      className={FIELD}
                    />
                  </div>

                  <div>
                    <label htmlFor="checkout-phone" className="eyebrow text-walnut-400">
                      Phone number
                    </label>
                    <input
                      id="checkout-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="71 123 456"
                      required
                      maxLength={40}
                      className={FIELD}
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-walnut-400">
                  Every loaf ferments for thirty-six hours, so the earliest pickup is{' '}
                  {formatPickupDate(pickup.min)}. We will call this number if anything comes up.
                </p>

                <div className="mt-5">
                  <label htmlFor="checkout-note" className="eyebrow text-walnut-400">
                    Note for the baker <span className="tracking-normal normal-case">(optional)</span>
                  </label>
                  <textarea
                    id="checkout-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={2}
                    maxLength={300}
                    placeholder="Allergies, slicing, a name for the bag…"
                    className={FIELD}
                  />
                </div>

                {payError && (
                  <p role="alert" className="mt-5 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
                    {payError}
                  </p>
                )}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  {/* Held back while a cart change is still saving, so the order
                      is built from the cart the customer is looking at. */}
                  <button
                    type="submit"
                    disabled={paying || pending}
                    className={`${PRIMARY} flex items-center justify-center gap-2.5`}
                  >
                    <WhishLogo size={22} />
                    {paying ? 'Opening Whish…' : `Pay ${formatCents(totalCents)} with Whish`}
                  </button>
                  <a
                    href={whatsappUrl(buildOrderMessage(lines, totalCents, { pickupDate, note }))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${SECONDARY} flex items-center justify-center gap-2.5`}
                  >
                    <DeliveryIcon className="h-5 w-5 shrink-0" />
                    Cash on delivery
                  </a>
                </div>
                <p className="mt-3 text-xs text-walnut-400">
                  Pay now with your Whish account, or choose cash on delivery: your order is sent
                  on WhatsApp and you pay in cash when you receive it.{' '}
                  <Link href="/menu" className="underline underline-offset-4 transition hover:text-walnut">
                    Keep browsing
                  </Link>
                </p>
              </form>
            ) : (
              <>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={() => setReviewing(true)} className={PRIMARY}>
                    Review Order
                  </button>
                  <Link href="/menu" className={SECONDARY}>
                    Keep browsing
                  </Link>
                </div>

                <ReviewOrderDialog
                  open={reviewing}
                  onClose={() => setReviewing(false)}
                  paymentsEnabled={false}
                />
              </>
            )}
          </>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-walnut-400">
        Signed in as {email} ·{' '}
        {paymentsEnabled && (
          <>
            <Link href="/orders" className="underline underline-offset-4 transition hover:text-walnut">
              Past orders
            </Link>{' '}
            ·{' '}
          </>
        )}
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="underline underline-offset-4 transition hover:text-walnut disabled:opacity-50"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </p>
    </>
  );
}
