import { expect, signInAsAdmin, test } from './support/fixtures';

/** The CMS. Read-only here: these tests never save, upload or delete. */
test.describe('admin', () => {
  test('a wrong password is refused', async ({ page }) => {
    await page.goto('/admin/login');
    await page.locator('#username').fill(process.env.ADMIN_USERNAME ?? 'admin');
    await page.locator('#password').fill('definitely-not-the-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('p[role="alert"]')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('signs in and reaches every section', async ({ page, menuItems }) => {
    await signInAsAdmin(page, '/admin/products');

    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
    await expect(page.getByRole('cell', { name: menuItems.loaves[0].name }).first()).toBeVisible();

    await page.getByRole('link', { name: 'Edit' }).first().click();
    // The first visit compiles the page in dev, which can take a while.
    await page.waitForURL('**/admin/products/*/edit', { timeout: 45_000 });
    await expect(page.locator('form')).toBeVisible();
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible();

    await page.getByRole('link', { name: 'Hero & Story' }).click();
    await expect(page.getByRole('heading', { name: 'Hero & Story' })).toBeVisible();
    await expect(page.locator('#hero-headline')).not.toBeEmpty();
    await expect(page.locator('#story-heading')).not.toHaveValue('');

    await page.getByRole('link', { name: 'Orders', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();

    await Promise.all([
      page.waitForResponse((response) => response.url().endsWith('/api/auth/logout')),
      page.getByRole('button', { name: /log ?out/i }).click(),
    ]);
    await page.goto('/admin/products');
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
