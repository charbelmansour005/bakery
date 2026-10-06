import Image from 'next/image';
import Link from 'next/link';
import { getStory } from '@/lib/story';
import FleurDeLis from './FleurDeLis';

/** The photograph comes from the CMS; lib/story.ts falls back to the default. */
export default async function Hero() {
  const { hero } = await getStory();

  return (
    // -mt-20 pulls the hero up behind the sticky nav so the nav can sit
    // transparently over the photograph; the inner padding puts the text back.
    <section className="relative -mt-20 flex min-h-[92dvh] items-center overflow-hidden lg:min-h-[88dvh]">
      <Image
        src={hero.url}
        alt={hero.alt}
        fill
        priority
        sizes="100vw"
        unoptimized={hero.url.startsWith('/api/media/')}
        className="object-cover object-center"
      />
      {/* Warm photography overlay, per the design: a flat #21150F fill at
          72.16%. Uniform rather than a gradient, so the whole frame darkens
          evenly and the copy reads wherever it sits. */}
      <div className="absolute inset-0 bg-[#21150F]/[0.7216]" />

      <div className="relative mx-auto w-full max-w-6xl px-6 pt-20 pb-16 lg:px-10">
        <div className="max-w-xl text-center lg:text-left">
          <div className="flex items-center justify-center gap-3 lg:justify-start">
            <FleurDeLis className="h-4 w-4 text-gold" />
            <span className="eyebrow text-gold">Est. 2026</span>
          </div>

          <h1 className="mt-6 font-display text-4xl leading-[1.15] text-cream sm:text-5xl lg:text-6xl">
            Naturally Fermented.
            <br />
            Hand Shaped.
            <br />
            <span className="text-gold">Baked Fresh.</span>
          </h1>

          <p className="mt-6 font-display text-lg italic text-cream/80 sm:text-xl">
            Slow-rested sourdough in small batches — choose your loaf, then make it yours.
          </p>

          <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row lg:items-start">
            <Link
              href="/menu"
              className="w-full rounded-lg bg-gold px-8 py-3.5 text-center text-sm font-semibold tracking-wide text-walnut transition hover:bg-gold-300 sm:w-auto"
            >
              Pre-Order Now
            </Link>
            <Link
              href="/#story"
              className="w-full rounded-lg border border-cream/40 px-8 py-3.5 text-center text-sm font-semibold tracking-wide text-cream transition hover:border-cream hover:bg-cream/10 sm:w-auto"
            >
              Our Story
            </Link>
          </div>
        </div>
      </div>

      {/* Watched by SiteNav to flip from transparent to solid. */}
      <div id="hero-sentinel" className="absolute bottom-0 h-px w-full" aria-hidden="true" />
    </section>
  );
}
