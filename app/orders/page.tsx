import Link from 'next/link';
import Footer from '@/components/site/Footer';
import SectionDivider from '@/components/site/SectionDivider';
import SiteNav from '@/components/site/SiteNav';
import { requireCustomer } from '@/lib/auth';
import { formatCents } from '@/lib/money';
import { listPaidOrdersForCustomer } from '@/lib/orders';
import { formatPickupDate } from '@/lib/pickup';
import { orderLineTitle } from '@/types/order';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Past orders · La Belle Fournée' };

export default async function OrdersPage() {
  const session = await requireCustomer('/orders');
  const orders = await listPaidOrdersForCustomer(session.sub);

  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-2xl px-6 pt-16 pb-24">
        <div className="text-center">
          <h1 className="font-display text-4xl text-walnut">Past orders</h1>
          <p className="mt-3 font-display text-base italic text-walnut-400">
            Everything you have paid for online.
          </p>
          <div className="mt-7 mb-9">
            <SectionDivider />
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-xl bg-cream-50 p-7 text-center shadow-soft">
            <p className="font-display text-lg italic text-walnut-400">No paid orders yet.</p>
            <Link
              href="/menu"
              className="mt-6 inline-block rounded-lg bg-gold px-6 py-3 text-sm font-semibold tracking-wide text-walnut transition hover:bg-gold-300"
            >
              Browse the menu
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="block rounded-xl bg-cream-50 p-6 shadow-soft transition hover:shadow-soft-lg"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="eyebrow text-gold">Order #{order.number}</p>
                    <p className="font-display text-xl text-walnut">{formatCents(order.totalCents)}</p>
                  </div>
                  <p className="mt-2 font-display text-lg text-walnut">
                    {order.lines.map(orderLineTitle).join(' · ')}
                  </p>
                  <p className="mt-1 text-xs text-walnut-400">
                    Pickup {formatPickupDate(order.pickupDate)}
                    {order.fulfilledAt ? ' · collected' : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-center text-xs text-walnut-400">
          <Link href="/cart" className="underline underline-offset-4 transition hover:text-walnut">
            Back to your order
          </Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
