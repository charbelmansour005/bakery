import { setCart } from './support/db';
import { expect, pickupInDays, test } from './support/fixtures';

/** The site as it is today: no Whish credentials. */
test.describe('before Whish is configured', () => {
  test.beforeEach(async ({ customer, menuItems }) => {
    await setCart(customer, [
      { baseId: menuItems.loaves[0].id, addOnId: menuItems.toppings[0].id },
    ]);
  });

  test('Review Order offers Whish as coming soon and cash on delivery over WhatsApp', async ({ page, menuItems }) => {
    await page.goto('/menu');
    await page.getByRole('button', { name: 'Review Order' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'How would you like to order?' })).toBeVisible();
    await expect(dialog).toContainText('Pay with Whish');
    await expect(dialog).toContainText('Coming soon');
    // Shown, but nothing to press.
    await expect(dialog.getByRole('link', { name: /Pay with Whish/ })).toHaveCount(0);
    await expect(dialog.locator('img[src*="whish"]')).toBeVisible();

    const cash = dialog.getByRole('link', { name: /Cash on delivery/ });
    const href = decodeURIComponent((await cash.getAttribute('href')) ?? '');
    expect(href).toContain('https://wa.me/96171862139');
    expect(href).toContain(menuItems.toppings[0].name);
    expect(href).toContain('Total:');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('the cart page has no checkout form, and the same dialog', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.locator('#checkout-pickup')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /with Whish/ })).toHaveCount(0);

    await page.getByRole('main').getByRole('button', { name: 'Review Order' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Coming soon');
    await dialog.getByRole('button', { name: 'Back to my order' }).click();
    await expect(dialog).toBeHidden();
  });

  test('the dialog fits a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/menu');
    await page.getByRole('button', { name: 'Review Order' }).click();
    const box = await page.getByRole('dialog').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    expect(box!.y + box!.height).toBeLessThanOrEqual(812);
  });

  test('checkout is refused server-side too', async ({ page }) => {
    const response = await page.request.post('/api/checkout', {
      data: { phone: '71123456', pickupDate: pickupInDays(3), note: '', expectedTotalCents: 1 },
    });
    expect(response.status()).toBe(503);
  });
});
