import Link from 'next/link';
import AddOnRow from '@/components/site/AddOnRow';
import Footer from '@/components/site/Footer';
import Hero from '@/components/site/Hero';
import IdeaBanner from '@/components/site/IdeaBanner';
import ProductCard from '@/components/site/ProductCard';
import SectionDivider from '@/components/site/SectionDivider';
import SiteNav from '@/components/site/SiteNav';
import StickyOrderBar from '@/components/site/StickyOrderBar';
import StorySection from '@/components/site/StorySection';
import { getProducts, groupByCategory } from '@/lib/products';
import { isWhishConfigured } from '@/lib/whish';

// Rendered per request so a change made in the CMS shows up immediately.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const products = await getProducts();
  const { base, savory, sweet } = groupByCategory(products);

  return (
    <>
      <SiteNav transparentOverHero />

      <main>
        <Hero />

        {/* Choose Your Sourdough */}
        <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <div className="text-center">
            <SectionDivider />
            <h2 className="mt-6 font-display text-4xl text-walnut lg:text-5xl">
              Choose Your Sourdough
            </h2>
            <p className="mt-3 font-display text-base italic text-walnut-400">
              Two loaves, both slow-fermented for thirty-six hours.
            </p>
          </div>

          <div className="mt-12 grid gap-7 md:grid-cols-2">
            {base.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index === 0} />
            ))}
          </div>
        </section>

        {/* Our Story */}
        <StorySection />

        {/* Make It Yours preview */}
        <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <div className="text-center">
            <SectionDivider />
            <h2 className="mt-6 font-display text-4xl text-walnut lg:text-5xl">Make It Yours</h2>
            <p className="mt-3 font-display text-base italic text-walnut-400">
              A little something folded through the dough.
            </p>
          </div>

          <div className="mt-12 grid gap-x-16 gap-y-10 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-4">
                <h3 className="eyebrow shrink-0 text-walnut-400">Savory</h3>
                <span className="h-px flex-1 bg-gold/30" aria-hidden="true" />
              </div>
              <ul className="space-y-2.5">
                {savory.map((product) => (
                  <AddOnRow key={product.id} product={product} />
                ))}
              </ul>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-4">
                <h3 className="eyebrow shrink-0 text-walnut-400">Sweet</h3>
                <span className="h-px flex-1 bg-gold/30" aria-hidden="true" />
              </div>
              <ul className="space-y-2.5">
                {sweet.map((product) => (
                  <AddOnRow key={product.id} product={product} />
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/menu"
              className="inline-block rounded-lg bg-gold px-8 py-3.5 text-sm font-semibold tracking-wide text-walnut transition hover:bg-gold-300"
            >
              See the Full Menu
            </Link>
          </div>
        </section>

        <IdeaBanner />
      </main>

      <Footer />
      <StickyOrderBar paymentsEnabled={isWhishConfigured()} />
    </>
  );
}
