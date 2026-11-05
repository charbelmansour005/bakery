'use client';

import { useState } from 'react';
import type { CrackerPackDTO } from '@/types/cracker';
import type { ProductDTO } from '@/types/product';
import CrackerSection from './CrackerSection';
import AddOnCard from './AddOnCard';
import FilterTabs, { type FilterKey } from './FilterTabs';
import ProductCard from './ProductCard';
import SectionDivider from './SectionDivider';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center gap-4">
      <h3 className="eyebrow shrink-0 text-walnut-400">{children}</h3>
      <span className="h-px flex-1 bg-gold/30" aria-hidden="true" />
    </div>
  );
}

function Empty({ what }: { what: string }) {
  return (
    <p className="rounded-xl border border-dashed border-gold/40 px-6 py-10 text-center font-display text-sm italic text-walnut-400">
      No {what} on the menu right now — check back soon.
    </p>
  );
}

export default function MenuBrowser({
  base,
  savory,
  sweet,
  crackers,
  packs,
}: {
  base: ProductDTO[];
  savory: ProductDTO[];
  sweet: ProductDTO[];
  crackers: ProductDTO[];
  packs: CrackerPackDTO[];
}) {
  const [filter, setFilter] = useState<FilterKey>('all');

  const showBase = filter === 'all' || filter === 'base';
  const showSavory = filter === 'all' || filter === 'savory';
  const showSweet = filter === 'all' || filter === 'sweet';
  const showAddOns = showSavory || showSweet;
  const showCrackers = filter === 'all' || filter === 'crackers';

  return (
    <>
      <div className="mx-auto max-w-6xl px-6 pb-12 lg:px-10">
        <FilterTabs active={filter} onChange={setFilter} />
      </div>

      {showBase && (
        <section className="mx-auto max-w-6xl px-6 pb-16 lg:px-10">
          <SectionLabel>Base Loaves</SectionLabel>
          {base.length === 0 ? (
            <Empty what="base loaves" />
          ) : (
            <div className="grid gap-7 md:grid-cols-2">
              {base.map((product, index) => (
                <ProductCard key={product.id} product={product} priority={index === 0} />
              ))}
            </div>
          )}
        </section>
      )}

      {showAddOns && (
        <section className="bg-cream-50 py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-6 lg:px-10">
            <div className="text-center">
              <SectionDivider />
              <h2 className="mt-6 font-display text-4xl text-walnut lg:text-5xl">Make It Yours</h2>
              <p className="mt-3 font-display text-base italic text-walnut-400">
                A little something folded through the dough.
              </p>
            </div>

            {showSavory && (
              <div className="mt-12">
                <SectionLabel>Savory</SectionLabel>
                {savory.length === 0 ? (
                  <Empty what="savory add-ons" />
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {savory.map((product) => (
                      <AddOnCard key={product.id} product={product} bases={base} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {showSweet && (
              <div className="mt-12">
                <SectionLabel>Sweet</SectionLabel>
                {sweet.length === 0 ? (
                  <Empty what="sweet add-ons" />
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {sweet.map((product) => (
                      <AddOnCard key={product.id} product={product} bases={base} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
      {showCrackers &&
        (crackers.length > 0 && packs.length > 0 ? (
          <CrackerSection flavors={crackers} packs={packs} />
        ) : (
          filter === 'crackers' && (
            <section className="mx-auto max-w-6xl px-6 pb-16 lg:px-10">
              <Empty what="crackers" />
            </section>
          )
        ))}
    </>
  );
}
