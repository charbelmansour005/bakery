import Footer from '@/components/site/Footer';
import IdeaBanner from '@/components/site/IdeaBanner';
import MenuBrowser from '@/components/site/MenuBrowser';
import SectionDivider from '@/components/site/SectionDivider';
import SiteNav from '@/components/site/SiteNav';
import StickyOrderBar from '@/components/site/StickyOrderBar';
import { getProducts, groupByCategory } from '@/lib/products';
import { isWhishConfigured } from '@/lib/whish';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'The Sourdough Menu · La Belle Fournée',
  description: 'Choose your loaf, make it yours. Pre-order freshly baked sourdough in limited batches.',
};

export default async function MenuPage() {
  const products = await getProducts();
  const { base, savory, sweet } = groupByCategory(products);

  return (
    <>
      {/* No hero here, so the nav renders solid in the server HTML — no flash. */}
      <SiteNav />

      <main>
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-12 text-center lg:px-10">
          <h1 className="font-display text-5xl text-walnut lg:text-6xl">The Sourdough Menu</h1>
          <p className="mt-4 font-display text-lg italic text-gold">
            Choose your loaf, make it yours
          </p>
          <div className="mt-8">
            <SectionDivider />
          </div>
        </div>

        <MenuBrowser base={base} savory={savory} sweet={sweet} />

        <IdeaBanner />
      </main>

      <Footer />
      <StickyOrderBar paymentsEnabled={isWhishConfigured()} />
    </>
  );
}
