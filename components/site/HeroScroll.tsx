'use client';

import { useEffect, useRef } from 'react';

/**
 * Turns scroll position into the numbers the hero's animation runs on.
 *
 * The section is made tall (see `.hero-track` in globals.css) with a sticky,
 * full-height stage inside it, so the hero holds still while the visitor scrolls
 * through it. As they do, three values are written straight onto the section as
 * CSS custom properties — no React state, so nothing re-renders per frame:
 *
 *   --p          overall progress, 0 to 1
 *   --p1..--p3   how far through each stage of the story, 0 to 1 (the stages
 *                overlap a little, so there is never a stretch where nothing moves)
 *
 * and the headline line for the current stage is marked `data-active`, which
 * dims the others. Everything visual is CSS reading those values.
 *
 * Does nothing for visitors who ask for reduced motion: the stylesheet shows
 * them the finished picture instead, in an ordinary-height hero.
 */

/** Where each stage begins and ends, as a fraction of the whole scroll. */
const STAGES = [
  [0, 0.4],
  [0.3, 0.7],
  [0.6, 1],
] as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export default function HeroScroll({ children }: { children: React.ReactNode }) {
  const track = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = track.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // The headline lines are rendered by the server from the CMS, so how many
    // there are is only known here. The stages are spread across however many.
    const lines = Array.from(root.querySelectorAll<HTMLElement>('[data-hero-line]'));
    let frame = 0;
    let stage = -1;

    const update = () => {
      frame = 0;

      const rect = root.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const progress = travel > 0 ? clamp01(-rect.top / travel) : 0;

      root.style.setProperty('--p', progress.toFixed(4));
      STAGES.forEach(([from, to], index) => {
        root.style.setProperty(`--p${index + 1}`, clamp01((progress - from) / (to - from)).toFixed(4));
      });

      const next = Math.max(0, Math.min(lines.length - 1, Math.floor(progress * lines.length)));
      if (next !== stage) {
        stage = next;
        lines.forEach((line, index) => {
          line.dataset.active = String(index === next);
        });
      }
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    // -mt-20 pulls the hero up behind the sticky nav so the nav can sit
    // transparently over the photograph; the stage's padding puts the text back.
    <section ref={track} className="hero-track relative -mt-20">
      {children}
    </section>
  );
}
