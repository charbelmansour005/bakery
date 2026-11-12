'use client';

import { useEffect, useRef } from 'react';

/**
 * Turns scroll position into the hero's progress, 0 to 1.
 *
 * The section is made tall (see `.hero-track` in globals.css) with a sticky,
 * full-height stage inside it, so the hero holds still while the visitor scrolls
 * through it. As they do, the progress is written onto the section as the CSS
 * custom property `--p` (no React state, so nothing re-renders per frame) and
 * announced as a `heroprogress` event, which JarScroll draws its frame from.
 *
 * Does nothing for visitors who ask for reduced motion: the stylesheet gives
 * them an ordinary-height hero, and the jar shows its last frame.
 */

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export default function HeroScroll({ children }: { children: React.ReactNode }) {
  const track = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = track.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;

    const update = () => {
      frame = 0;

      const rect = root.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const progress = travel > 0 ? clamp01(-rect.top / travel) : 0;

      root.style.setProperty('--p', progress.toFixed(4));
      root.dispatchEvent(new CustomEvent('heroprogress', { detail: progress }));
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
