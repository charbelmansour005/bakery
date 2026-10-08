import CartView from '@/components/site/CartView';
import Footer from '@/components/site/Footer';
import SectionDivider from '@/components/site/SectionDivider';
import SiteNav from '@/components/site/SiteNav';
import { requireCustomer } from '@/lib/auth';
import { lastPhoneFor } from '@/lib/orders';
import { pickupWindow } from '@/lib/pickup';
import { isWhishConfigured } from '@/lib/whish';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Your order · La Belle Fournée' };

export default async function CartPage() {
  const session = await requireCustomer('/cart');
  const paymentsEnabled = isWhishConfigured();
  const lastPhone = paymentsEnabled ? await lastPhoneFor(session.sub) : '';

  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-2xl px-6 pt-16 pb-24">
        <div className="text-center">
          <h1 className="font-display text-4xl text-walnut">Your order</h1>
          <p className="mt-3 font-display text-base italic text-walnut-400">
            Each loaf baked to order.
          </p>
          <div className="mt-7 mb-9">
            <SectionDivider />
          </div>
        </div>

        {/* The pickup window is worked out here, on the server, so the form and
            the validation behind it can never disagree about what "today" is. */}
        <CartView
          email={session.email}
          paymentsEnabled={paymentsEnabled}
          pickup={pickupWindow()}
          lastPhone={lastPhone}
        />
      </main>
      <Footer />
    </>
  );
}
