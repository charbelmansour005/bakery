import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import frames from '../lib/hero-frames.json';

/**
 * The hero: the starter jar rising, played by scrolling. No database writes —
 * these tests only read the home page.
 */

const track = (page: Page) => page.locator('.hero-track');

/** The hero's progress (0 to 1), as written by the scroll handler. */
async function progress(page: Page): Promise<number> {
  return Number(await track(page).evaluate((el) => getComputedStyle(el).getPropertyValue('--p')));
}

/** Scrolls to a fraction (0 to 1) of the way through the hero's pinned stretch. */
async function scrollThroughHero(page: Page, fraction: number) {
  await page.evaluate((f) => {
    const section = document.querySelector('.hero-track')!;
    const travel = section.getBoundingClientRect().height - window.innerHeight;
    // `instant`: the page has smooth scrolling on, which would animate this.
    window.scrollTo({ top: travel * f, behavior: 'instant' });
  }, fraction);
}

/** A fingerprint of what the canvas is showing right now. */
const picture = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.hero-track canvas')!;
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4 * 97) sum += data[i] + data[i + 1] + data[i + 2];
    return sum;
  });

const framesFetched = (page: Page) =>
  page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('/images/hero-jar/')).length);

test.describe('hero jar', () => {
  test('every frame arrives, and the picture follows the scroll — forwards and back', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => framesFetched(page), { timeout: 30_000 }).toBeGreaterThanOrEqual(frames.count);

    // Let the opening frame draw, then remember it.
    await expect.poll(() => progress(page)).toBe(0);
    await expect.poll(() => picture(page)).toBeGreaterThan(0);
    const opening = await picture(page);

    await scrollThroughHero(page, 0.5);
    await expect.poll(() => progress(page)).toBeCloseTo(0.5, 1);
    await expect.poll(() => picture(page)).not.toBe(opening);
    const middle = await picture(page);

    await scrollThroughHero(page, 1);
    await expect.poll(() => progress(page)).toBeGreaterThan(0.99);
    await expect.poll(() => picture(page)).not.toBe(middle);
    const end = await picture(page);
    expect(end).not.toBe(opening);

    // Scrolling back up plays it in reverse: the very same pictures return.
    await scrollThroughHero(page, 0.5);
    await expect.poll(() => picture(page)).toBe(middle);
    await scrollThroughHero(page, 0);
    await expect.poll(() => picture(page)).toBe(opening);
  });

  test('the first and last frames are fetched before the rest, so scrubbing works early', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/images/hero-jar/')) requested.push(request.url().split('/').pop()!);
    });
    await page.goto('/');
    await expect.poll(() => requested.length, { timeout: 30_000 }).toBeGreaterThanOrEqual(frames.count);

    const first = String(0).padStart(3, '0') + '.webp';
    const last = String(frames.count - 1).padStart(3, '0') + '.webp';
    // The page's own <img> asks for frame 0 straight away; the last follows within the first few.
    expect(requested.indexOf(first)).toBeLessThan(4);
    expect(requested.indexOf(last)).toBeLessThan(8);
    // And a coarse set (every 16th) arrives before the in-betweens: frame 16 before frame 17.
    expect(requested.indexOf('016.webp')).toBeLessThan(requested.indexOf('017.webp'));
  });

  test('the stage holds still while pinned, then lets the page go', async ({ page }) => {
    await page.goto('/');
    const stage = page.locator('.hero-stage');
    const nav = page.getByRole('banner');

    await expect(stage).toHaveCSS('position', 'sticky');
    await expect(nav).not.toHaveClass(/bg-cream/);

    // Pinned: the stage stays at the top of the screen however far we scroll.
    await scrollThroughHero(page, 0.6);
    await expect.poll(async () => Math.round((await stage.boundingBox())!.y)).toBe(0);
    await expect(nav).not.toHaveClass(/bg-cream/);

    // Past the hero: the page below is reachable and the nav turns solid.
    await page.evaluate(() => {
      const section = document.querySelector('.hero-track')!;
      // Exactly the hero's height: the section after it now starts at the top.
      window.scrollTo({ top: section.getBoundingClientRect().height, behavior: 'instant' });
    });
    await expect(page.getByRole('heading', { name: 'Choose Your Sourdough' })).toBeInViewport();
    await expect(nav).toHaveClass(/bg-cream/);
  });

  test('the hero buttons still work', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Pre-Order Now' }).first()).toHaveAttribute('href', '/menu');

    await page.getByRole('link', { name: 'Our Story' }).first().click();
    await expect(page).toHaveURL(/#story$/);
    await expect(page.locator('#story')).toBeInViewport();
  });

  test('a phone gets the whole hero on the first screen, jar included', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const jar = (await page.locator('.hero-track canvas').locator('..').boundingBox())!;
    const lastButton = (await page.locator('.hero-stage a').last().boundingBox())!;
    expect(jar.y).toBeGreaterThanOrEqual(0);
    expect(jar.x).toBeGreaterThanOrEqual(0);
    expect(jar.x + jar.width).toBeLessThanOrEqual(375);
    expect(lastButton.y + lastButton.height).toBeLessThanOrEqual(667);

    const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflowing).toBe(false);
  });

  test('the picture is decorative and the headline stays real text', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero-track canvas').locator('..')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(await page.getByRole('heading', { level: 1 }).innerText()).not.toBe('');
  });
});

test.describe('hero jar, reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('an ordinary hero showing the risen starter, with nothing animated or downloaded', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/images/hero-jar/')) requested.push(request.url().split('/').pop()!);
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // An ordinary-height hero, not a two-screen scroll.
    const height = (await track(page).boundingBox())!.height;
    expect(height).toBeLessThan(page.viewportSize()!.height * 1.5);
    await expect(page.locator('.hero-stage')).not.toHaveCSS('position', 'sticky');
    expect(await progress(page)).toBe(1);

    // The last frame, and only that one: the rest is never fetched.
    const lastFrame = String(frames.count - 1).padStart(3, '0') + '.webp';
    await expect.poll(() => page.locator('.hero-track picture img').evaluate((img: HTMLImageElement) => img.currentSrc)).toContain(lastFrame);
    await page.waitForTimeout(1500);
    expect(requested.filter((name) => name !== lastFrame)).toEqual([]);

    // Scrolling changes nothing about the picture.
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
    expect(await progress(page)).toBe(1);
  });
});
