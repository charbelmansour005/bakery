import Link from 'next/link';
import { notFound } from 'next/navigation';
import CartRefresh from '@/components/site/CartRefresh';
import Footer from '@/components/site/Footer';
import OrderPending from '@/components/site/OrderPending';
import SectionDivider from '@/components/site/SectionDivider';
import SiteNav from '@/components/site/SiteNav';
import { requireCustomer } from '@/lib/auth';
import { BAKERY } from '@/lib/config';
import { formatCents } from '@/lib/money';
import { getOrderForCustomer, settleOrder } from '@/lib/orders';
import { formatPickupDate } from '@/lib/pickup';
import { buildSavedOrderMessage, whatsappUrl } from '@/lib/whatsapp';
import { isConfirmed, orderLineTitle } from '@/types/order';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Your order · La Belle Fournée' };

/**
 * One order. It is where the customer lands after Whish's payment page — for a
 * success and a failure alike, showing what Whish confirms when asked, never
 * what the URL they arrived on claims — and after placing a cash order. It is
 * also what each entry in "My orders" opens.
 */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireCustomer(`/orders/${id}`);

  let order = await getOrderForCustomer(id, session.sub);
  if (!order) notFound();

  // Covers a callback that is late or never arrives: settle on the way in.
  if (order.settleable) {
    await settleOrder(id);
    order = (await getOrderForCustomer(id, session.sub)) ?? order;
  }

  const confirmed = isConfirmed(order.status);
  const cash = order.paymentMethod === 'cash';

  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-2xl px-6 pt-16 pb-24">
        <div className="text-center">
          <p className="eyebrow text-gold">Order #{order.number}</p>
          <h1 className="mt-3 font-display text-4xl text-walnut">
            {order.status === 'paid'
              ? 'Thank you — it’s paid'
              : order.status === 'placed'
                ? 'Your order is placed'
                : order.status === 'failed'
                  ? 'Payment not completed'
                  : 'Almost there'}
          </h1>
          <div className="mt-7 mb-9">
            <SectionDivider />
          </div>
        </div>

        {order.mode === 'test' && !cash && (
          <p className="mb-5 rounded-lg border border-gold/40 bg-gold/10 px-4 py-2.5 text-center text-xs text-walnut">
            Test payment — no money has moved and nothing will be baked.
          </p>
        )}

        <div className="rounded-xl bg-cream-50 p-7 shadow-soft">
          {order.status === 'pending' && <OrderPending number={order.number} payUrl={order.payUrl} />}

          {order.status === 'failed' && (
            <div className="text-center">
              <p className="font-display text-lg italic text-walnut-400">
                The payment did not go through, and nothing was charged.
              </p>
              <p className="mt-2 text-sm text-walnut-400">Your order is still saved — you can try again.</p>
              <Link
                href="/cart"
                className="mt-6 inline-block rounded-lg bg-gold px-6 py-3 text-sm font-semibold tracking-wide text-walnut transition hover:bg-gold-300"
              >
                Back to my order
              </Link>
            </div>
          )}

          {confirmed && (
            <>
              <CartRefresh />

              <ul className="divide-y divide-cream-200">
                {order.lines.map((line) => (
                  <li key={line.key} className="flex items-baseline justify-between gap-4 py-3.5">
                    <span className="font-display text-lg text-walnut">{orderLineTitle(line)}</span>
                    <span className="shrink-0 font-display text-lg text-gold">
                      {formatCents(line.totalCents)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-2 flex items-baseline justify-between border-t border-walnut/15 pt-4">
                <span className="eyebrow text-walnut-400">
                  {cash ? 'Total due on delivery' : 'Total paid'}
                </span>
                <span className="font-display text-2xl text-walnut">{formatCents(order.totalCents)}</span>
              </div>

              <dl className="mt-7 grid gap-5 border-t border-walnut/15 pt-6 sm:grid-cols-2">
                <div>
                  <dt className="eyebrow text-walnut-400">Pickup</dt>
                  <dd className="mt-1.5 font-display text-lg text-walnut">
                    {order.pickupDate ? formatPickupDate(order.pickupDate) : 'To be arranged'}
                  </dd>
                  <dd className="text-sm text-walnut-400">{BAKERY.address}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-walnut-400">We will reach you on</dt>
                  <dd className="mt-1.5 font-display text-lg text-walnut">{order.phone || 'WhatsApp'}</dd>
                  <dd className="text-sm text-walnut-400">
                    {cash ? 'A confirmation' : 'A receipt'} was sent to {order.email}.
                  </dd>
                </div>
                {order.note && (
                  <div className="sm:col-span-2">
                    <dt className="eyebrow text-walnut-400">Your note</dt>
                    <dd className="mt-1.5 text-sm whitespace-pre-line text-walnut">{order.note}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={whatsappUrl(buildSavedOrderMessage(order))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-gold px-6 py-3 text-center text-sm font-semibold tracking-wide text-walnut transition hover:bg-gold-300"
                >
                  Send my order on WhatsApp
                </a>
                <Link
                  href="/menu"
                  className="rounded-lg border border-walnut/30 px-6 py-3 text-center text-sm font-semibold tracking-wide text-walnut transition hover:border-walnut hover:bg-walnut/5"
                >
                  Back to the menu
                </Link>
              </div>
              <p className="mt-3 text-xs text-walnut-400">
                {cash
                  ? 'The bakery has your order. If WhatsApp did not open, send it from here so we can confirm the details with you.'
                  : 'The bakery already has your order. Sending it on WhatsApp just puts it in your chat with us too.'}{' '}
                <Link href="/orders" className="underline underline-offset-4 transition hover:text-walnut">
                  See all my orders
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
