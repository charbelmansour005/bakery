'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useCart } from './cart-context';

type Details = { phone?: string; pickupDate?: string; note?: string };

/**
 * Places the cart as a cash-on-delivery order: saves it, opens WhatsApp with
 * the order written out, and moves on to the order's own page.
 *
 * The WhatsApp tab is opened at once, empty, and pointed at the chat only when
 * the order is saved. A tab opened after the request returns no longer counts
 * as the customer's own action, and iPhones block it as a pop-up. If it is
 * blocked anyway, nothing is lost: the order page offers the same link.
 */
export function useCashOrder() {
  const router = useRouter();
  const { totalCents, refresh } = useCart();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const place = useCallback(
    async (details: Details = {}): Promise<boolean> => {
      setPlacing(true);
      setError(null);

      const tab = window.open('', '_blank');

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The total is only compared server-side; the order is built from the
        // server's own copy of the cart.
        body: JSON.stringify({ ...details, expectedTotalCents: totalCents }),
      }).catch(() => null);

      const data = ((await response?.json().catch(() => ({}))) ?? {}) as {
        orderId?: string;
        whatsappUrl?: string;
        error?: string;
      };

      if (!response?.ok || !data.orderId || !data.whatsappUrl) {
        tab?.close();
        if (response?.status === 401) {
          router.push('/account/login?from=/cart');
          return false;
        }
        // The cart moved under us: show the customer what it holds now.
        if (response?.status === 409) await refresh();
        setError(
          data.error ??
            (response ? 'Could not place the order. Try again.' : 'Could not reach the server. Check your connection.'),
        );
        setPlacing(false);
        return false;
      }

      if (tab) {
        // The chat has no business holding a handle on this page.
        tab.opener = null;
        tab.location.href = data.whatsappUrl;
      }

      // The server has emptied the cart; bring the nav's count in line.
      await refresh();
      router.push(`/orders/${data.orderId}`);
      return true;
    },
    [router, refresh, totalCents],
  );

  return { place, placing, error };
}
