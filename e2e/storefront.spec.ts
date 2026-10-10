import { expect, test } from './support/fixtures';

test.describe('storefront, signed out', () => {
  test('home page shows the hero, the loaves and the story', async ({ page, menuItems }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Choose Your Sourdough' })).toBeVisible();
    await expect(page.getByRole('heading', { name: menuItems.loaves[0].name }).first()).toBeVisible();
    await expect(page.locator('#story')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toContainText('Runtime Collective');
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /icon\.svg/);
  });

  test('menu lists every product and the tabs filter it', async ({ page, menuItems }) => {
    await page.goto('/menu');
    const main = page.getByRole('main');

    for (const item of [...menuItems.loaves, ...menuItems.toppings]) {
      await expect(main.getByRole('heading', { name: item.name, exact: true })).toBeVisible();
    }

    await page.getByRole('tab', { name: 'Base Loaves' }).click();
    await expect(page.getByRole('tab', { name: 'Base Loaves' })).toHaveAttribute('aria-selected', 'true');
    await expect(main.getByRole('heading', { name: menuItems.loaves[0].name, exact: true })).toBeVisible();
    await expect(main.getByRole('heading', { name: menuItems.toppings[0].name, exact: true })).toBeHidden();
  });

  test('ordering needs an account: tapping a loaf leads to sign-in', async ({ page }) => {
    await page.goto('/menu');
    await page.getByRole('button', { name: 'Add plain loaf' }).first().click();
    await page.waitForURL('**/account/login?from=%2Fmenu');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('private pages redirect to sign-in', async ({ page }) => {
    for (const path of ['/cart', '/orders']) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/account/login\\?from=${encodeURIComponent(path)}`));
    }
    await page.goto('/admin/orders');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('the idea form opens WhatsApp with the idea written in', async ({ page, context }) => {
    // Caught here rather than let through: the test must not load WhatsApp itself.
    let opened = '';
    await context.route(/wa\.me|whatsapp\.com/, (route) => {
      opened ||= route.request().url();
      return route.abort();
    });

    await page.goto('/#have-an-idea');
    const section = page.locator('#have-an-idea');
    await section.locator('#idea').fill('Fig and rosemary');
    await section.getByRole('button', { name: 'Send via WhatsApp' }).click();

    await expect.poll(() => opened).toContain('https://wa.me/96171862139');
    expect(decodeURIComponent(opened)).toContain('Fig and rosemary');
    await expect(section.getByRole('link', { name: 'Open WhatsApp' })).toBeVisible();
  });
});

test.describe('locked endpoints', () => {
  test('refuse requests that are not signed in', async ({ request }) => {
    expect((await request.get('/api/cart')).status()).toBe(401);
    expect((await request.post('/api/checkout', { data: {} })).status()).toBe(401);
    expect((await request.patch('/api/orders/000000000000000000000000', { data: { fulfilled: true } })).status()).toBe(401);
    expect((await request.patch('/api/story', { data: { heading: 'x' } })).status()).toBe(401);
    expect((await request.post('/api/products', { data: {} })).status()).toBe(401);
    expect((await request.post('/api/upload')).status()).toBe(401);
  });

  test('the Whish callback ignores requests that name no real order', async ({ request }) => {
    expect((await request.get('/api/whish/callback')).status()).toBe(404);
    expect(
      (await request.get('/api/whish/callback?order=000000000000000000000000&t=x&result=success')).status(),
    ).toBe(404);
  });

  test('a customer session is not an admin session', async ({ page, customer }) => {
    expect(customer.id).toBeTruthy();
    const response = await page.request.patch('/api/orders/000000000000000000000000', {
      data: { fulfilled: true },
    });
    expect(response.status()).toBe(401);
    await page.goto('/admin/products');
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
