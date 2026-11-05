'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCart } from '@/lib/cart-context';
import { formatCents } from '@/lib/money';
import { packLabel, type CrackerPackDTO } from '@/types/cracker';
import type { ProductDTO } from '@/types/product';
import ProductImage from './ProductImage';

/**
 * Build a cracker pack: choose a size, tap the flavors to mix into it, add it.
 *
 * The choice is local until "Add pack" — tapping flavors needs no account. The
 * add goes through the cart, which sends a signed-out customer to sign in, and
 * which turns a second identical pack into a quantity of two.
 */
export default function CrackerBuilder({ flavors, packs }: { flavors: ProductDTO[]; packs: CrackerPackDTO[] }) {
  const { addCrackerPack, pending } = useCart();
  const [packId, setPackId] = useState(packs[0]?.id ?? '');
  const [chosen, setChosen] = useState<string[]>([]);
  const [added, setAdded] = useState<string | null>(null);

  const pack = packs.find((candidate) => candidate.id === packId) ?? packs[0];
  const full = pack ? chosen.length >= pack.maxFlavors : true;
  const chosenFlavors = useMemo(
    () => flavors.filter((flavor) => chosen.includes(flavor.id)),
    [flavors, chosen],
  );

  // The confirmation fades on its own.
  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(null), 3500);
    return () => window.clearTimeout(timer);
  }, [added]);

  if (!pack) return null;

  function choosePack(next: CrackerPackDTO) {
    setPackId(next.id);
    // A smaller pack keeps the first flavors picked, up to what it holds.
    setChosen((current) => current.slice(0, next.maxFlavors));
  }

  function toggle(flavor: ProductDTO) {
    setAdded(null);
    setChosen((current) => {
      if (current.includes(flavor.id)) return current.filter((id) => id !== flavor.id);
      if (current.length >= pack.maxFlavors) return current;
      return [...current, flavor.id];
    });
  }

  function add() {
    if (chosenFlavors.length === 0) return;
    addCrackerPack(pack, chosenFlavors);
    setAdded(`${packLabel(pack)} · ${chosenFlavors.map((flavor) => flavor.name).join(', ')}`);
    setChosen([]);
  }

  return (
    <div>
      {/* 1 — the pack */}
      <h3 className="eyebrow text-center text-walnut-400">1 · Choose your pack</h3>
      <div role="group" aria-label="Pack size" className="mx-auto mt-5 grid max-w-2xl grid-cols-2 gap-3 sm:gap-4">
        {packs.map((candidate) => {
          const selected = candidate.id === pack.id;
          return (
            <button
              key={candidate.id}
              type="button"
              aria-pressed={selected}
              onClick={() => choosePack(candidate)}
              className={`rounded-xl border px-3 py-4 text-center transition sm:px-6 sm:py-5 ${
                selected
                  ? 'border-walnut bg-walnut text-cream shadow-soft'
                  : 'border-gold/40 bg-cream-50 text-walnut hover:border-gold'
              }`}
            >
              <span className={`eyebrow block ${selected ? 'text-gold-300' : 'text-walnut-400'}`}>{candidate.name}</span>
              <span className="mt-1 block font-display text-3xl sm:text-4xl">{candidate.grams}g</span>
              <span className={`mt-1 block font-display text-xl sm:text-2xl ${selected ? 'text-gold-300' : 'text-gold'}`}>
                {formatCents(candidate.price)}
              </span>
              <span className={`mt-2 block text-[11px] leading-snug sm:text-xs ${selected ? 'text-cream/70' : 'text-walnut-400'}`}>
                Mix up to {candidate.maxFlavors} flavor{candidate.maxFlavors === 1 ? '' : 's'}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2 — the flavors */}
      <h3 className="eyebrow mt-12 text-center text-walnut-400">
        2 · Choose up to {pack.maxFlavors} flavor{pack.maxFlavors === 1 ? '' : 's'}
      </h3>
      <ul className="mt-6 grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-4">
        {flavors.map((flavor, index) => {
          const selected = chosen.includes(flavor.id);
          const unavailable = !selected && full;
          return (
            <li key={flavor.id}>
              <button
                type="button"
                aria-pressed={selected}
                disabled={unavailable}
                onClick={() => toggle(flavor)}
                className="group block w-full text-center disabled:cursor-not-allowed"
              >
                <span
                  className={`relative block aspect-square overflow-hidden rounded-xl ring-2 transition ${
                    selected ? 'ring-gold' : 'ring-transparent group-hover:ring-gold/40'
                  } ${unavailable ? 'opacity-40' : ''}`}
                >
                  {/* The name below labels the button; the photo would only repeat it. */}
                  <ProductImage
                    src={flavor.imageUrl}
                    alt=""
                    sizes="(min-width: 640px) 22vw, 45vw"
                    priority={index < 4}
                  />
                  {selected && (
                    <span className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-gold text-walnut shadow-soft">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4" aria-hidden="true">
                        <path d="M5 12l5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </span>
                <span className={`mt-3 block font-display text-sm tracking-[0.12em] uppercase ${unavailable ? 'text-walnut-400/60' : 'text-walnut'}`}>
                  {flavor.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-8 text-center font-display text-sm italic tracking-wide text-walnut-400 uppercase">
        More crunches to come.
      </p>

      {/* 3 — add it */}
      <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-4 rounded-xl border border-gold/40 bg-cream-50 px-6 py-5 sm:flex-row sm:justify-between">
        <div className="text-center sm:text-left">
          <p className="text-sm text-walnut" aria-live="polite">
            <span className="font-semibold">
              {chosen.length} of {pack.maxFlavors}
            </span>{' '}
            flavor{pack.maxFlavors === 1 ? '' : 's'} chosen
            {chosenFlavors.length > 0 && <> · {chosenFlavors.map((flavor) => flavor.name).join(', ')}</>}
          </p>
          {added ? (
            <p role="status" className="mt-1 text-xs text-gold">
              Added to your order: {added}
            </p>
          ) : (
            <p className="mt-1 text-xs text-walnut-400">Choose any flavor, or mix and match.</p>
          )}
        </div>
        <button
          type="button"
          onClick={add}
          disabled={chosen.length === 0 || pending}
          className="w-full shrink-0 rounded-lg bg-gold px-6 py-3 text-sm font-semibold tracking-wide text-walnut transition hover:bg-gold-300 disabled:opacity-50 sm:w-auto"
        >
          Add pack — {formatCents(pack.price)}
        </button>
      </div>
    </div>
  );
}
