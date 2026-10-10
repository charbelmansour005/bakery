'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import { useSignOut } from '@/lib/use-sign-out';

/**
 * The customer's corner of the nav: a cart icon (with a count of items) and
 * Sign out when signed in; Sign in otherwise. There is no cart without an
 * account — ordering requires one — so a signed-out visitor sees Sign in only.
 *
 * Two shapes. `inline` sits in the nav bar and is hidden on small screens,
 * where there is no room beside the logo and the Pre-Order button; `menu`
 * renders as rows inside the mobile dropdown so the controls are still
 * reachable there.
 */

function CartIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function orderLabel(count: number): string {
  return count === 0 ? 'Your order, empty' : `Your order, ${count} item${count === 1 ? '' : 's'}`;
}

export default function AccountButton({
  solid = true,
  variant = 'inline',
  onNavigate,
}: {
  solid?: boolean;
  variant?: 'inline' | 'menu';
  onNavigate?: () => void;
}) {
  const { signedIn, count } = useCart();
  const pathname = usePathname();
  const { signOut, busy } = useSignOut(onNavigate);

  const loginHref = `/account/login?from=${encodeURIComponent(pathname)}`;

  if (variant === 'menu') {
    const row =
      'eyebrow flex w-full items-center gap-3 border-b border-cream-200 py-4 text-left text-walnut-400 transition-colors hover:text-walnut';

    if (!signedIn) {
      return (
        <li>
          <Link href={loginHref} onClick={onNavigate} className={row}>
            Sign in
          </Link>
        </li>
      );
    }

    return (
      <>
        <li>
          <Link href="/cart" onClick={onNavigate} aria-label={orderLabel(count)} className={row}>
            <CartIcon className="h-4 w-4" />
            Your order
            {count > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[0.65rem] font-semibold tracking-normal text-walnut">
                {count}
              </span>
            )}
          </Link>
        </li>
        <li>
          <Link href="/orders" onClick={onNavigate} className={row}>
            My orders
          </Link>
        </li>
        <li>
          <button type="button" onClick={signOut} disabled={busy} className={`${row} disabled:opacity-50`}>
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
        </li>
      </>
    );
  }

  const tone = solid ? 'text-walnut-400 hover:text-walnut' : 'text-cream/75 hover:text-cream';

  if (!signedIn) {
    return (
      <Link href={loginHref} className={`eyebrow hidden transition-colors sm:block ${tone}`}>
        Sign in
      </Link>
    );
  }

  return (
    <div className="hidden items-center gap-4 sm:flex">
      <Link
        href="/cart"
        aria-label={orderLabel(count)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-colors ${tone}`}
      >
        <CartIcon className="h-5 w-5" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[0.6rem] leading-none font-semibold text-walnut"
          >
            {count}
          </span>
        )}
      </Link>
      <Link href="/orders" className={`eyebrow transition-colors ${tone}`}>
        My orders
      </Link>
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className={`eyebrow transition-colors disabled:opacity-50 ${tone}`}
      >
        {busy ? '…' : 'Sign out'}
      </button>
    </div>
  );
}
