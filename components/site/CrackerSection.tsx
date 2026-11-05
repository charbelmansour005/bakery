import type { CrackerPackDTO } from '@/types/cracker';
import type { ProductDTO } from '@/types/product';
import CrackerBuilder from './CrackerBuilder';
import SectionDivider from './SectionDivider';

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

/**
 * "The Sourdough Crackers", after the poster: the flavors, then the packs.
 * Renders nothing until both exist, so the section appears only once the
 * crackers have been added to the menu.
 */
export default function CrackerSection({ flavors, packs }: { flavors: ProductDTO[]; packs: CrackerPackDTO[] }) {
  if (flavors.length === 0 || packs.length === 0) return null;
  const count = COUNT_WORDS[flavors.length] ?? String(flavors.length);

  return (
    <section id="crackers" className="bg-cream-200/50 py-20 lg:py-24">
      <div className="mx-auto max-w-5xl px-6 lg:px-10">
        <div className="text-center">
          <SectionDivider />
          <h2 className="mt-6 font-display text-4xl text-walnut lg:text-5xl">The Sourdough Crackers</h2>
          <p className="mt-3 font-display text-base italic text-walnut-400">
            {count} flavor{flavors.length === 1 ? '' : 's'}, crafted from our sourdough starter.
          </p>
        </div>

        <div className="mt-12">
          <CrackerBuilder flavors={flavors} packs={packs} />
        </div>
      </div>
    </section>
  );
}
