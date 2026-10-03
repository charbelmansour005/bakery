'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Wheel scrolling with a speed limit and an eased glide.
 *
 * Each wheel event moves a *target* position, and the page eases toward it
 * every frame instead of jumping. Two caps keep it controlled: one on how far a
 * single wheel event can push the target (a free-spinning mouse wheel cannot
 * fling the page), and one on how fast the page may travel.
 *
 * Deliberately left native: touch scrolling (the OS already does this well),
 * keyboard and scrollbar, anything inside its own scrollable box, pinch-zoom,
 * the admin, and visitors who ask for reduced motion.
 */

/** Furthest one wheel event may move the target, in px. */
const MAX_STEP = 110;
/** Top speed of the glide, in px per second. */
const MAX_SPEED = 2200;
/** How quickly the page closes the gap to the target. Higher = snappier. */
const EASE_RATE = 7;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** True when the wheel happened inside something that scrolls on its own. */
function insideScrollable(target: EventTarget | null): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== document.body && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

export default function SmoothScroll() {
  const pathname = usePathname();
  const enabled = !pathname.startsWith('/admin');

  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let target = window.scrollY;
    let current = window.scrollY;
    let frame = 0;
    let lastTime = 0;

    const limit = () => document.documentElement.scrollHeight - window.innerHeight;

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const tick = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      const gap = target - current;
      if (Math.abs(gap) < 0.5) {
        window.scrollTo({ top: target, behavior: 'instant' });
        frame = 0;
        return;
      }

      // Exponential ease, frame-rate independent, then the speed limit.
      const eased = gap * (1 - Math.exp(-EASE_RATE * dt));
      current += clamp(eased, -MAX_SPEED * dt, MAX_SPEED * dt);
      // `instant` matters: html has `scroll-behavior: smooth` for anchor links,
      // which would otherwise animate every one of these per-frame steps.
      window.scrollTo({ top: current, behavior: 'instant' });
      frame = requestAnimationFrame(tick);
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.defaultPrevented) return; // pinch-zoom
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (document.body.style.overflow === 'hidden') return; // a dialog is open
      if (insideScrollable(event.target)) return;

      event.preventDefault();

      let delta = event.deltaY;
      if (event.deltaMode === 1) delta *= 16; // lines
      else if (event.deltaMode === 2) delta *= window.innerHeight; // pages

      // Starting from rest: pick up wherever the page actually is, since the
      // keyboard, scrollbar or an anchor link may have moved it.
      if (!frame) {
        current = window.scrollY;
        target = current;
      }

      target = clamp(target + clamp(delta, -MAX_STEP, MAX_STEP), 0, limit());

      if (!frame) {
        lastTime = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };

    // Something else moved the page mid-glide (anchor link, keyboard) — yield.
    const onScroll = () => {
      if (frame && Math.abs(window.scrollY - current) > 4) stop();
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      stop();
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', onScroll);
    };
  }, [enabled]);

  return null;
}
