import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';

/**
 * The hero's scroll-driven sourdough story. No database writes: these tests only
 * read the home page, so they are safe to run against the shared database.
 */

const track = (page: Page) => page.locator('.hero-track');

/** A CSS custom property on the hero, as a number. */
async function hero(page: Page, name: string): Promise<number> {
  return Number(await track(page).evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), name));
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

const activeLine = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-hero-line]')].findIndex((line) => line.dataset.active === 'true'),
  );

test.describe('hero animation', () => {
  test('starts at the first stage, and the story advances as the page scrolls', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // The opening frame: a starter jar, the first line lit.
    expect(await hero(page, '--p')).toBe(0);
    await expect.poll(() => activeLine(page)).toBe(0);
    await expect(page.locator('.ds-jar')).toHaveCSS('opacity', '1');
    await expect(page.locator('.ds-crust')).toHaveCSS('opacity', '0');

    // Partway through: the starter has risen and the dough is taking shape.
    await scrollThroughHero(page, 0.25);
    await expect.poll(() => hero(page, '--p1')).toBeGreaterThan(0.4);

    await scrollThroughHero(page, 0.5);
    await expect.poll(() => hero(page, '--p2')).toBeGreaterThan(0.3);
    await expect.poll(() => activeLine(page)).toBe(1);

    // The end: the jar is gone, the loaf is baked, the last line is lit.
    await scrollThroughHero(page, 1);
    await expect.poll(() => hero(page, '--p3')).toBeGreaterThan(0.99);
    await expect.poll(() => activeLine(page)).toBe(2);
    await expect(page.locator('.ds-jar')).toHaveCSS('opacity', '0');
    await expect(page.locator('.ds-crust')).toHaveCSS('opacity', '1');

    // And it runs backwards: scrolling up returns to the start.
    await scrollThroughHero(page, 0);
    await expect.poll(() => hero(page, '--p')).toBe(0);
    await expect.poll(() => activeLine(page)).toBe(0);
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

  test('a phone gets the whole hero on the first screen, with room to spare', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const scene = (await page.locator('.dough-scene').boundingBox())!;
    const lastButton = (await page.locator('.hero-stage a').last().boundingBox())!;
    expect(scene.y).toBeGreaterThanOrEqual(0);
    expect(lastButton.y + lastButton.height).toBeLessThanOrEqual(667);

    const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflowing).toBe(false);
  });

  test('the picture is decorative and the headline stays real text', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.dough-scene')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(await page.getByRole('heading', { level: 1 }).innerText()).not.toBe('');
  });
});

test.describe('hero animation, reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('no pinning and no scroll animation: an ordinary hero showing the finished loaf', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // An ordinary-height hero, not a two-screen scroll.
    const height = (await track(page).boundingBox())!.height;
    const viewport = page.viewportSize()!.height;
    expect(height).toBeLessThan(viewport * 1.5);
    await expect(page.locator('.hero-stage')).not.toHaveCSS('position', 'sticky');

    // The finished picture, from the first frame.
    await expect(page.locator('.ds-crust')).toHaveCSS('opacity', '1');
    await expect(page.locator('.ds-jar')).toHaveCSS('opacity', '0');
    expect(await hero(page, '--p3')).toBe(1);

    // Every headline line stays readable, because nothing dims them.
    const dimmed = await page.locator('[data-hero-line][data-active="false"]').count();
    expect(dimmed).toBe(0);

    // Scrolling changes nothing about the picture.
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
    expect(await hero(page, '--p3')).toBe(1);
  });
});
