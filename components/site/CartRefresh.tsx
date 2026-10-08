'use client';

import { useEffect } from 'react';
import { useCart } from '@/lib/cart-context';

/**
 * A paid order empties the cart on the server. Rendered on the confirmation
 * page so the cart in the nav catches up without a reload.
 */
export default function CartRefresh() {
  const { refresh } = useCart();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return null;
}
