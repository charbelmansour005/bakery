'use client';

import { useEffect, useRef } from 'react';
import frames from '@/lib/hero-frames.json';

/**
 * The starter jar rising, played by scrolling: scroll down and time moves
 * forward, scroll up and it runs backwards.
 *
 * The recording was turned into a sequence of still frames
 * (`npm run hero:frames`), because a video cannot be scrubbed smoothly by scroll
 * position — seeking is slow and jerky unless nearly every frame is a keyframe,
 * which phone recordings are not. Stills draw instantly on every browser.
 *
 * HeroScroll turns scroll position into a 0–1 progress and announces it as a
 * `heroprogress` event on the hero; this component draws the frame for that
 * moment onto a canvas, blending the two nearest frames so the motion stays
 * smooth between them.
 *
 * Frames load coarse to fine — the first and last, then every 16th, every 8th,
 * and so on — so scrubbing works almost at once and sharpens as more arrive.
 * Until then, and without scripts, a plain <img> of the first frame shows.
 *
 * Visitors who ask for reduced motion see the last frame, the risen starter,
 * and nothing is loaded or animated for them.
 */

const { count, width, height } = frames;
const last = count - 1;
const frameUrl = (index: number) => `/images/hero-jar/${String(index).padStart(3, '0')}.webp`;

/** The order frames are fetched in: a rough picture first, then ever finer. */
function loadOrder(stride: number): number[] {
  const order: number[] = [0, last];
  const seen = new Set(order);
  for (let step = 16; step >= stride; step = Math.floor(step / 2)) {
    for (let i = 0; i <= last; i += step) {
      if (!seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    }
    if (step === 1) break;
  }
  return order;
}

export default function JarScroll({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const track = canvas?.closest<HTMLElement>('.hero-track');
    const context = canvas?.getContext('2d');
    if (!canvas || !track || !context) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const images: (HTMLImageElement | undefined)[] = new Array(count);
    let progress = 0;
    let cancelled = false;

    /** The nearest frame that has actually arrived. */
    const nearest = (index: number): HTMLImageElement | undefined => {
      for (let distance = 0; distance < count; distance++) {
        const before = images[index - distance];
        if (before) return before;
        const after = images[index + distance];
        if (after) return after;
      }
      return undefined;
    };

    const draw = () => {
      const position = progress * last;
      const lower = Math.floor(position);
      const upper = Math.min(last, lower + 1);
      const fraction = position - lower;

      const from = images[lower] ?? nearest(lower);
      if (!from) return;
      context.globalAlpha = 1;
      context.drawImage(from, 0, 0, width, height);

      // Between two frames, fade the next over this one: motion stays smooth
      // however far apart the frames are.
      const to = images[upper] ?? nearest(upper);
      if (to && to !== from && fraction > 0.002) {
        context.globalAlpha = fraction;
        context.drawImage(to, 0, 0, width, height);
        context.globalAlpha = 1;
      }
    };

    const onProgress = (event: Event) => {
      progress = Math.min(1, Math.max(0, (event as CustomEvent<number>).detail));
      draw();
    };
    track.addEventListener('heroprogress', onProgress);

    // Fetch the frames, a few at a time. People on a data saver get a sparser set.
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const queue = loadOrder(saveData ? 4 : 1);
    const next = async () => {
      while (!cancelled) {
        const index = queue.shift();
        if (index === undefined) return;
        const image = new Image();
        image.decoding = 'async';
        image.src = frameUrl(index);
        try {
          await image.decode();
        } catch {
          continue; // a missing frame is skipped; the nearest one stands in
        }
        images[index] = image;
        draw();
      }
    };
    for (let worker = 0; worker < 6; worker++) void next();

    return () => {
      cancelled = true;
      track.removeEventListener('heroprogress', onProgress);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`relative aspect-[9/16] overflow-hidden rounded-2xl bg-walnut-700 shadow-2xl ring-1 ring-gold/40 ${className}`}
    >
      {/* What shows before the canvas has drawn, without scripts, and for reduced motion. */}
      <picture>
        <source media="(prefers-reduced-motion: reduce)" srcSet={frameUrl(last)} />
        <img src={frameUrl(0)} alt="" width={width} height={height} className="absolute inset-0 h-full w-full object-cover" />
      </picture>
      <canvas ref={canvasRef} width={width} height={height} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
