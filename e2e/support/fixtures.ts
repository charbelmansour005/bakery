import { test as base, expect, type Page } from '@playwright/test';
import { createCustomer, menu, sessionCookie, type MenuItem, type TestCustomer } from './db';

type Fixtures = {
  /** A brand-new customer, already signed in on `page`. */
  customer: TestCustomer;
  menuItems: { loaves: MenuItem[]; toppings: MenuItem[] };
};

// Playwright's convention names the callback `use`; it is called `provide`
// here because the React hooks lint rule mistakes `use(...)` for the React hook.
export const test = base.extend<Fixtures>({
  customer: async ({ context, baseURL }, provide) => {
    const customer = await createCustomer();
    await context.addCookies([await sessionCookie(customer, baseURL!)]);
    await provide(customer);
  },
  menuItems: async ({ baseURL }, provide) => {
    void baseURL;
    await provide(await menu());
  },
});

export { expect };

export const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** The pickup day input's earliest allowed value — whatever the server offered. */
export async function earliestPickup(page: Page): Promise<string> {
  return (await page.locator('#checkout-pickup').getAttribute('min')) ?? '';
}

/** Admin credentials come from .env.local, the same ones `npm run seed` installs. */
export async function signInAsAdmin(page: Page, destination = '/admin/orders') {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) throw new Error('ADMIN_USERNAME / ADMIN_PASSWORD are not set.');

  await page.goto(`/admin/login?from=${encodeURIComponent(destination)}`);
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(`**${destination}`);
}

/** A pickup day safely inside the window the site offers (2 to 15 days ahead). */
export function pickupInDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}
