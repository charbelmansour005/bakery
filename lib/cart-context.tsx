'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ProductDTO } from '@/types/product';
import { makeLine, totalOf, type CartDTO, type CartLineDTO } from '@/types/cart';

/**
 * The cart lives on the server, one per customer, so it survives a reload and
 * follows the customer between devices. This provider is a thin optimistic
 * layer over it: local state updates immediately, the write goes out behind it,
 * and a failed write rolls back and re-syncs from the server.
 *
 * A cart is a list of lines — each a loaf, optionally with one topping. Each
 * topping appears at most once, and so does each plain loaf; the helpers below
 * keep it that way by construction, and lib/cart.ts enforces it again.
 *
 * Ordering requires an account, so a tap while signed out sends the customer to
 * sign in rather than quietly dropping the item.
 */

type CartState = {
  signedIn: boolean;
  lines: CartLineDTO[];
  count: number;
  isEmpty: boolean;
  totalCents: number;
  /** The line a topping is in, if it has been ordered. */
  lineForAddOn: (addOnId: string) => CartLineDTO | undefined;
  hasPlain: (baseId: string) => boolean;
  /** Adds the topping on this loaf — or, if it is already ordered, moves it to this loaf. */
  setToppingLoaf: (addOn: ProductDTO, base: ProductDTO) => void;
  togglePlain: (base: ProductDTO) => void;
  removeLine: (key: string) => void;
  clear: () => void;
  /** Re-reads the cart from the server — after a payment has emptied it there. */
  refresh: () => Promise<void>;
  pending: boolean;
  error: string | null;
};

const CartContext = createContext<CartState | null>(null);

function toPayload(lines: CartLineDTO[]) {
  return {
    lines: lines.map((line) => ({ baseId: line.base.id, addOnId: line.addOn?.id ?? null })),
  };
}

export function CartProvider({
  children,
  signedIn,
  initialCart,
}: {
  children: React.ReactNode;
  signedIn: boolean;
  initialCart: CartDTO;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [lines, setLines] = useState<CartLineDTO[]>(initialCart.lines);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Mutations derive from this ref rather than from the render closure, so two
   * taps that land before a re-render still build on each other.
   */
  const linesRef = useRef(lines);
  const commit = useCallback((next: CartLineDTO[]) => {
    linesRef.current = next;
    setLines(next);
  }, []);

  /** Bumped on every local change, so a slow server read can tell it is stale. */
  const generation = useRef(0);

  /**
   * A full page load can render the cart server-side while the previous page's
   * write is still in flight, and show the cart as it was *before* that write.
   * Because writes replace the whole cart, the customer's next tap would then
   * send that stale list back — resurrecting an item they had just removed.
   *
   * So once hydrated, re-read the cart and adopt it — unless the customer has
   * already changed something, in which case this snapshot is older than what
   * they are looking at and must not overwrite it.
   */
  useEffect(() => {
    if (!signedIn) return;
    const startedAt = generation.current;
    let cancelled = false;

    fetch('/api/cart')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { cart?: CartDTO } | null) => {
        if (!cancelled && data?.cart && generation.current === startedAt) commit(data.cart.lines);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [signedIn, commit]);

  /**
   * Writes are chained rather than fired in parallel: two rapid taps would
   * otherwise race, and whichever response landed last would win regardless of
   * which tap came last.
   */
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  /** After a failed write, adopt whatever the server actually holds. */
  const resync = useCallback(async () => {
    const response = await fetch('/api/cart').catch(() => null);
    if (!response?.ok) return;
    const data = (await response.json().catch(() => null)) as { cart?: CartDTO } | null;
    if (data?.cart) commit(data.cart.lines);
  }, [commit]);

  const persist = useCallback(
    (next: CartLineDTO[], rollback: () => void) => {
      setPending(true);
      setError(null);

      queue.current = queue.current
        .then(async () => {
          const response = await fetch('/api/cart', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toPayload(next)),
            // Let the write outlive the page: without this, navigating away or
            // closing the tab mid-request can abort it.
            keepalive: true,
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            rollback();
            setError(data.error ?? 'Could not update your order.');
            // The session can expire mid-visit; send them back to sign in.
            if (response.status === 401) {
              router.push('/account/login');
              return;
            }
            await resync();
          }
        })
        .catch(async () => {
          rollback();
          setError('Could not reach the server. Check your connection.');
          await resync();
        })
        .finally(() => setPending(false));
    },
    [router, resync],
  );

  /** Returns false when the customer must sign in first. */
  const ensureSignedIn = useCallback(() => {
    if (signedIn) return true;
    router.push(`/account/login?from=${encodeURIComponent(pathname)}`);
    return false;
  }, [signedIn, router, pathname]);

  const mutate = useCallback(
    (transform: (current: CartLineDTO[]) => CartLineDTO[]) => {
      if (!ensureSignedIn()) return;
      const previous = linesRef.current;
      const next = transform(previous);
      if (next === previous) return;
      generation.current += 1;
      commit(next);
      persist(next, () => commit(previous));
    },
    [ensureSignedIn, commit, persist],
  );

  const setToppingLoaf = useCallback(
    (addOn: ProductDTO, base: ProductDTO) =>
      mutate((current) => {
        const index = current.findIndex((line) => line.addOn?.id === addOn.id);
        if (index === -1) return [...current, makeLine(base, addOn)];
        if (current[index].base.id === base.id) return current;
        // Switching loaves keeps the line where it was in the order.
        const next = current.slice();
        next[index] = makeLine(base, addOn);
        return next;
      }),
    [mutate],
  );

  const togglePlain = useCallback(
    (base: ProductDTO) =>
      mutate((current) =>
        current.some((line) => !line.addOn && line.base.id === base.id)
          ? current.filter((line) => !(!line.addOn && line.base.id === base.id))
          : [...current, makeLine(base, null)],
      ),
    [mutate],
  );

  const removeLine = useCallback(
    (key: string) => mutate((current) => current.filter((line) => line.key !== key)),
    [mutate],
  );

  const clear = useCallback(
    () => mutate((current) => (current.length === 0 ? current : [])),
    [mutate],
  );

  const value = useMemo<CartState>(
    () => ({
      signedIn,
      lines,
      count: lines.length,
      isEmpty: lines.length === 0,
      totalCents: totalOf(lines),
      lineForAddOn: (addOnId: string) => lines.find((line) => line.addOn?.id === addOnId),
      hasPlain: (baseId: string) => lines.some((line) => !line.addOn && line.base.id === baseId),
      setToppingLoaf,
      togglePlain,
      removeLine,
      clear,
      refresh: resync,
      pending,
      error,
    }),
    [signedIn, lines, setToppingLoaf, togglePlain, removeLine, clear, resync, pending, error],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside a CartProvider');
  return context;
}
