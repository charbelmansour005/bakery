import Link from 'next/link';
import FulfilButton from '@/components/admin/FulfilButton';
import { requireAdmin } from '@/lib/auth';
import { formatCents } from '@/lib/money';
import { listOrdersForAdmin, reconcileUnpaidOrders } from '@/lib/orders';
import { formatPickupDate } from '@/lib/pickup';
import { isWhishConfigured, whishMode } from '@/lib/whish';
import { isConfirmed, orderLineTitle, type OrderDTO } from '@/types/order';

export const dynamic = 'force-dynamic';

function placedAt(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Beirut',
  }).format(new Date(iso));
}

function StatusBadge({ order }: { order: OrderDTO }) {
  const [label, tone] =
    order.status === 'pending'
      ? ['Not paid', 'bg-slate-100 text-slate-600']
      : order.status === 'failed'
        ? ['Payment failed', 'bg-red-50 text-red-700']
        : order.fulfilledAt
          ? ['Done', 'bg-slate-100 text-slate-600']
          : order.paymentMethod === 'cash'
            ? ['Cash — to bake', 'bg-amber-50 text-amber-800']
            : ['Paid — to bake', 'bg-green-50 text-green-700'];

  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${tone}`}>
      {label}
    </span>
  );
}

export default async function OrdersAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  await requireAdmin();

  const showAll = (await searchParams).show === 'all';
  // Catch any payment whose confirmation never reached us before listing.
  await reconcileUnpaidOrders();
  const orders = await listOrdersForAdmin({ includeUnpaid: showAll });
  const open = orders.filter((order) => isConfirmed(order.status) && !order.fulfilledAt).length;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Orders</h1>
          <p className="mt-1 text-sm text-slate-500">
            {open} order{open === 1 ? '' : 's'} to bake. Soonest pickup first.
          </p>
        </div>
        <Link
          href={showAll ? '/admin/orders' : '/admin/orders?show=all'}
          className="text-sm text-slate-600 underline underline-offset-4 transition hover:text-slate-900"
        >
          {showAll ? 'Hide unpaid attempts' : 'Also show unpaid attempts'}
        </Link>
      </div>

      {!isWhishConfigured() && (
        <p className="mt-5 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Online payment is switched off — the Whish credentials are not set, so customers can only
          order cash on delivery.
        </p>
      )}
      {isWhishConfigured() && whishMode() === 'test' && (
        <p className="mt-5 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Whish is in test mode. Orders marked paid are test payments — no money has moved.
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        {orders.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">
            No orders yet. They appear here the moment one is placed or paid for.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Pickup</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <tr key={order.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">#{order.number}</p>
                    <p className="text-xs whitespace-nowrap text-slate-500">{placedAt(order.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-900">
                    {order.pickupDate ? formatPickupDate(order.pickupDate) : 'To arrange'}
                  </td>
                  <td className="px-4 py-3">
                    {order.phone && <p className="text-slate-900">{order.phone}</p>}
                    <p className="text-xs text-slate-500">{order.email}</p>
                    {order.payerPhone && order.payerPhone !== order.phone && (
                      <p className="text-xs text-slate-500">Paid from {order.payerPhone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ul className="space-y-0.5 text-slate-900">
                      {order.lines.map((line) => (
                        <li key={line.key}>{orderLineTitle(line)}</li>
                      ))}
                    </ul>
                    {order.note && (
                      <p className="mt-1.5 max-w-xs text-xs whitespace-pre-line text-slate-600">
                        <span className="font-medium">Note:</span> {order.note}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-900">
                    {formatCents(order.totalCents)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge order={order} />
                      {isConfirmed(order.status) && (
                        <FulfilButton
                          id={order.id}
                          number={order.number}
                          fulfilled={Boolean(order.fulfilledAt)}
                        />
                      )}
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
