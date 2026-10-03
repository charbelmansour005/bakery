import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import SmoothScroll from '@/components/site/SmoothScroll';
import { CartProvider } from '@/lib/cart-context';
import { getCustomerSession } from '@/lib/session';
import { getCart } from '@/lib/cart';
import { EMPTY_CART } from '@/types/cart';
import './globals.css';

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'La Belle Fournée · Artisan Bakery',
  description:
    'Naturally fermented, hand shaped, baked fresh. Choose your sourdough loaf and make it yours — pre-order from La Belle Fournée.',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Verifying the session is a local JWT check, no database round trip — the
  // cart is only fetched once we know someone is actually signed in.
  const session = await getCustomerSession();
  const cart = session ? await getCart(session.sub) : EMPTY_CART;

  return (
    <html lang="en">
      <body className={`${playfair.variable} ${inter.variable} antialiased`}>
        <SmoothScroll />
        <CartProvider signedIn={Boolean(session)} initialCart={cart}>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
