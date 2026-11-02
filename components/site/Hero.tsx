import Image from 'next/image';
import Link from 'next/link';
import { getStory } from '@/lib/story';
import DoughScene from './DoughScene';
import FleurDeLis from './FleurDeLis';
import HeroScroll from './HeroScroll';

/**
 * Photograph and copy come from the CMS; lib/story.ts falls back to the
 * defaults. The picture beside the headline is a sourdough story that plays as
 * the visitor scrolls through the hero (see HeroScroll and DoughScene).
 */
export default async function Hero() {
  const { hero, heroEyebrow, heroHeadline, heroTagline } = await getStory();
  // Edited as plain text, one headline row per line; the last row is gold.
  const lines = heroHeadline
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <HeroScroll>
      {/* The stage holds still (sticky) while the section scrolls past it. */}
      <div className="hero-stage">
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

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-3 px-6 pt-20 pb-8 lg:grid-cols-2 lg:gap-10 lg:px-10 lg:pb-16">
          <div className="order-last max-w-xl justify-self-center text-center lg:order-first lg:justify-self-start lg:text-left">
            <div className="flex items-center justify-center gap-3 lg:justify-start">
              <FleurDeLis className="h-4 w-4 text-gold" />
              <span className="eyebrow text-gold">{heroEyebrow}</span>
            </div>

            <h1 className="mt-4 font-display text-4xl leading-[1.15] text-cream sm:text-5xl lg:mt-6 lg:text-6xl">
              {lines.map((line, index) => (
                <span
                  key={index}
                  data-hero-line
                  className={`hero-line block ${index === lines.length - 1 && lines.length > 1 ? 'text-gold' : ''}`}
                >
                  {line}
                </span>
              ))}
            </h1>

            <p className="mt-4 font-display text-lg italic text-cream/80 sm:text-xl lg:mt-6">
              {heroTagline}
            </p>

            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:mt-9 lg:items-start">
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

          <DoughScene className="order-first mx-auto h-[min(24dvh,15rem)] w-auto lg:order-last lg:h-auto lg:w-full lg:max-w-lg lg:justify-self-end" />
        </div>

        {/* Says there is more to see; gone after the first scroll. */}
        <div className="hero-cue" aria-hidden="true">
          <span className="eyebrow text-cream/70">Scroll</span>
          <span className="h-8 w-px bg-gold/70 motion-safe:animate-pulse" />
        </div>
      </div>

      {/* Watched by SiteNav to flip from transparent to solid. */}
      <div id="hero-sentinel" className="absolute bottom-0 h-px w-full" aria-hidden="true" />
    </HeroScroll>
  );
}
