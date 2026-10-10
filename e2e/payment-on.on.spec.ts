import type { Page } from '@playwright/test';
import { cartLineCount, createCustomer, ordersOf, sessionCookie, setCart, type TestCustomer } from './support/db';
import { dollars, earliestPickup, expect, pickupInDays, signInAsAdmin, test } from './support/fixtures';

/**
 * Payment switched on, with Whish played by scripts/whish-mock.ts. Its payment
 * page has one link per outcome; these tests press them.
 */

const MOCK = 'http://localhost:4010';

async function fillCheckout(page: Page, phone = '71 123 456', note = '') {
  await page.locator('#checkout-phone').fill(phone);
  if (note) await page.locator('#checkout-note').fill(note);
}

async function payUntilWhish(page: Page) {
  await page.getByRole('button', { name: /Pay \$[\d.]+ with Whish/ }).click();
  await page.waitForURL(`${MOCK}/pay/*`);
}

test.describe('paying with Whish', () => {
  let total = 0;

  test.beforeEach(async ({ customer, menuItems }) => {
    const [loaf] = menuItems.loaves;
    const [topping] = menuItems.toppings;
    await setCart(customer, [
      { baseId: loaf.id, addOnId: topping.id },
      { baseId: loaf.id, addOnId: null },
    ]);
    total = loaf.price + topping.price + loaf.price;
  });

  test('from the order bar to a paid order, end to end', async ({ page, customer, menuItems }) => {
    const [loaf] = menuItems.loaves;
    const [topping] = menuItems.toppings;

    // Review Order → dialog → Pay with Whish → the cart's checkout form.
    await page.goto('/menu');
    await page.getByRole('button', { name: 'Review Order' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).not.toContainText('Coming soon');
    await expect(dialog.getByRole('link', { name: /Cash on delivery/ })).toHaveAttribute('href', /wa\.me\/96171862139/);
    await dialog.getByRole('link', { name: /Pay with Whish/ }).click();
    await page.waitForURL('**/cart');

    await expect(page.getByRole('heading', { name: 'Pickup details' })).toBeVisible();
    const pickup = await earliestPickup(page);
    expect(pickup).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await expect(page.locator('#checkout-pickup')).toHaveValue(pickup);
    await fillCheckout(page, '+961 71-123 456', 'Sliced, please. <b>bold</b>');

    // Whish is asked for exactly the cart total.
    await payUntilWhish(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${(total / 100).toFixed(2)} USD`);

    const [pending] = await ordersOf(customer);
    expect(pending.status).toBe('pending');
    expect(pending.totalCents).toBe(total);
    expect(pending.mode).toBe('test');
    // Nothing is cleared until Whish confirms.
    expect(await cartLineCount(customer)).toBe(2);

    await page.getByRole('link', { name: /^Approve\s*Marks it paid/ }).click();
    await page.waitForURL(`**/orders/${pending._id}`);

    await expect(page.getByRole('heading', { name: 'Thank you — it’s paid' })).toBeVisible();
    await expect(page.getByText(`Order #${pending.number}`)).toBeVisible();
    await expect(page.getByText('Test payment')).toBeVisible();
    const main = page.getByRole('main');
    await expect(main).toContainText(`${topping.name} on ${loaf.name}`);
    await expect(main).toContainText(`${loaf.name}, plain`);
    await expect(main).toContainText(dollars(total));
    await expect(main).toContainText('+96171123456');
    // The note is shown as text, never as markup.
    await expect(main).toContainText('Sliced, please. <b>bold</b>');
    await expect(main.locator('b', { hasText: 'bold' })).toHaveCount(0);

    const whatsapp = decodeURIComponent(
      (await main.getByRole('link', { name: 'Send my order on WhatsApp' }).getAttribute('href')) ?? '',
    );
    expect(whatsapp).toContain(`I just paid for order #${pending.number} online.`);
    expect(whatsapp).toContain(`Total paid: ${dollars(total)}`);

    const [paid] = await ordersOf(customer);
    expect(paid.status).toBe('paid');
    expect(paid.phone).toBe('+96171123456');
    expect(paid.pickupDate).toBe(pickup);
    expect(paid.payerPhone).toBeTruthy();
    expect(await cartLineCount(customer)).toBe(0);
    await expect(page.getByRole('link', { name: 'Your order, empty' }).first()).toBeVisible();

    await page.goto('/orders');
    await expect(page.getByRole('link', { name: new RegExp(`Order #${pending.number}`) })).toBeVisible();
  });

  test('a declined payment leaves the cart alone, and a retry on Whish still counts', async ({ page, customer }) => {
    await page.goto('/cart');
    await fillCheckout(page);
    await payUntilWhish(page);
    const payUrl = page.url();

    await page.getByRole('link', { name: /^Decline/ }).click();
    await expect(page.getByRole('heading', { name: 'Payment not completed' })).toBeVisible();
    expect((await ordersOf(customer))[0].status).toBe('failed');
    expect(await cartLineCount(customer)).toBe(2);

    await page.getByRole('link', { name: 'Back to my order' }).click();
    await page.waitForURL('**/cart');

    // The customer goes back to the same Whish page and pays after all.
    await page.goto(payUrl);
    await page.getByRole('link', { name: /^Approve\s*Marks it paid/ }).click();
    await expect(page.getByRole('heading', { name: 'Thank you — it’s paid' })).toBeVisible();
    expect((await ordersOf(customer))[0].status).toBe('paid');
    expect(await cartLineCount(customer)).toBe(0);
  });

  test('a lost callback is caught when the customer returns', async ({ page, customer }) => {
    await page.goto('/cart');
    await fillCheckout(page);
    await payUntilWhish(page);

    await page.getByRole('link', { name: /^Approve, but lose the callback/ }).click();
    await expect(page.getByRole('heading', { name: 'Thank you — it’s paid' })).toBeVisible();
    expect((await ordersOf(customer))[0].status).toBe('paid');
  });

  test('a callback delivered twice pays the order once', async ({ page, customer }) => {
    await page.goto('/cart');
    await fillCheckout(page);
    await payUntilWhish(page);

    await page.getByRole('link', { name: /^Approve, callback delivered twice/ }).click();
    await expect(page.getByRole('heading', { name: 'Thank you — it’s paid' })).toBeVisible();
    const orders = await ordersOf(customer);
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe('paid');
  });

  test('leaving without paying shows “confirming”, then flips once Whish confirms', async ({ page, customer }) => {
    await page.goto('/cart');
    await fillCheckout(page);
    await payUntilWhish(page);
    const payUrl = page.url();

    await page.getByRole('link', { name: /^Leave without paying/ }).click();
    await expect(page.getByRole('heading', { name: 'Confirming your payment…' })).toBeVisible();
    expect((await ordersOf(customer))[0].status).toBe('pending');

    // Paid from elsewhere, callback lost: the open page notices on its own.
    const response = await page.request.get(`${payUrl}/act?do=approve-silent`, { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    await expect(page.getByRole('heading', { name: 'Thank you — it’s paid' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: 'Your order, empty' }).first()).toBeVisible();
  });

  test('a forged callback cannot mark an order paid', async ({ page, customer }) => {
    await page.goto('/cart');
    await fillCheckout(page);
    await payUntilWhish(page);
    const [order] = await ordersOf(customer);

    const wrongToken = await page.request.get(`/api/whish/callback?order=${order._id}&t=not-the-token&result=success`);
    expect(wrongToken.status()).toBe(404);

    // Even with the real token, "success" in the URL means nothing: Whish still says pending.
    const rightToken = await page.request.get(
      `/api/whish/callback?order=${order._id}&t=${order.callbackToken}&result=success`,
    );
    expect(rightToken.status()).toBe(503);
    expect((await ordersOf(customer))[0].status).toBe('pending');
    expect(await cartLineCount(customer)).toBe(2);
  });

  test('the amount is the server’s: a stale or tampered total is refused', async ({ page, customer }) => {
    await page.goto('/cart');
    const response = await page.request.post('/api/checkout', {
      data: { phone: '71123456', pickupDate: pickupInDays(3), note: '', expectedTotalCents: 1 },
    });
    expect(response.status()).toBe(409);
    expect(await ordersOf(customer)).toHaveLength(0);
  });

  test('checkout details are validated', async ({ page, customer }) => {
    const send = (data: Record<string, unknown>) =>
      page.request.post('/api/checkout', {
        data: { phone: '71123456', pickupDate: pickupInDays(3), note: '', expectedTotalCents: total, ...data },
      });

    expect((await send({ phone: 'call me' })).status()).toBe(400);
    expect((await send({ pickupDate: pickupInDays(0) })).status()).toBe(400);
    expect((await send({ pickupDate: pickupInDays(40) })).status()).toBe(400);
    expect((await send({ pickupDate: '2026-02-31' })).status()).toBe(400);
    expect((await send({ note: 'x'.repeat(301) })).status()).toBe(400);
    expect(await ordersOf(customer)).toHaveLength(0);

    // And the form itself will not submit without a phone number.
    await page.goto('/cart');
    await page.getByRole('button', { name: /with Whish/ }).click();
    await expect(page).toHaveURL(/\/cart$/);
    expect(await ordersOf(customer)).toHaveLength(0);
  });

  test('an empty cart cannot be checked out', async ({ page, customer }) => {
    await setCart(customer, []);
    const response = await page.request.post('/api/checkout', {
      data: { phone: '71123456', pickupDate: pickupInDays(3), note: '', expectedTotalCents: 0 },
    });
    expect(response.status()).toBe(400);
  });

  test('something added while paying is not swept away with the paid order', async ({ page, customer, menuItems }) => {
    const extra = menuItems.toppings[1] ?? menuItems.toppings[0];
    test.skip(menuItems.toppings.length < 2, 'needs two toppings on the menu');

    await page.goto('/cart');
    await fillCheckout(page);
    await payUntilWhish(page);

    await setCart(customer, [
      { baseId: menuItems.loaves[0].id, addOnId: menuItems.toppings[0].id },
      { baseId: menuItems.loaves[0].id, addOnId: null },
      { baseId: menuItems.loaves[0].id, addOnId: extra.id },
    ]);

    await page.getByRole('link', { name: /^Approve\s*Marks it paid/ }).click();
    await expect(page.getByRole('heading', { name: 'Thank you — it’s paid' })).toBeVisible();
    expect(await cartLineCount(customer)).toBe(1);
  });

  test('an order page belongs to its customer only', async ({ page, customer, browser, baseURL }) => {
    await page.goto('/cart');
    await fillCheckout(page);
    await payUntilWhish(page);
    await page.getByRole('link', { name: /^Approve\s*Marks it paid/ }).click();
    await expect(page.getByRole('heading', { name: 'Thank you — it’s paid' })).toBeVisible();
    const [order] = await ordersOf(customer);

    const stranger: TestCustomer = await createCustomer('stranger');
    const context = await browser.newContext();
    await context.addCookies([await sessionCookie(stranger, baseURL!)]);
    const other = await context.newPage();
    const response = await other.goto(`${baseURL}/orders/${order._id}`);
    expect(response!.status()).toBe(404);
    await other.goto(`${baseURL}/orders`);
    await expect(other.getByText('No paid orders yet.')).toBeVisible();
    await context.close();
  });
});

test.describe('the bakery’s side', () => {
  test('a paid order appears in the admin and can be marked done', async ({ page, customer, menuItems }) => {
    const [loaf] = menuItems.loaves;
    await setCart(customer, [{ baseId: loaf.id, addOnId: null }]);

    await page.goto('/cart');
    await fillCheckout(page, '03 123 456', 'Name on the bag: Test');
    await payUntilWhish(page);
    await page.getByRole('link', { name: /^Approve\s*Marks it paid/ }).click();
    await expect(page.getByRole('heading', { name: 'Thank you — it’s paid' })).toBeVisible();
    const [order] = await ordersOf(customer);

    await signInAsAdmin(page);
    await expect(page.getByText('Whish is in test mode.')).toBeVisible();

    const row = page.getByRole('row', { name: new RegExp(`#${order.number}`) });
    await expect(row).toContainText(customer.email);
    await expect(row).toContainText('03123456');
    await expect(row).toContainText(`${loaf.name}, plain`);
    await expect(row).toContainText('Name on the bag: Test');
    await expect(row).toContainText(dollars(loaf.price));
    await expect(row).toContainText('Paid — to bake');

    await row.getByRole('button', { name: 'Mark done' }).click();
    await expect(row).toContainText('Done');
    await expect(row.getByRole('button', { name: 'Undo' })).toBeVisible();
    expect((await ordersOf(customer))[0].fulfilledAt).toBeTruthy();

    await row.getByRole('button', { name: 'Undo' }).click();
    await expect(row).toContainText('Paid — to bake');
  });

  test('opening the admin Orders page catches a payment nobody came back for', async ({ page, customer, menuItems }) => {
    await setCart(customer, [{ baseId: menuItems.loaves[0].id, addOnId: null }]);
    await page.goto('/cart');
    await fillCheckout(page);
    await payUntilWhish(page);
    const payUrl = page.url();

    // Paid, callback lost, and the customer never returns to the site.
    await page.request.get(`${payUrl}/act?do=approve-silent`, { maxRedirects: 0 });
    expect((await ordersOf(customer))[0].status).toBe('pending');

    await signInAsAdmin(page);
    const [order] = await ordersOf(customer);
    expect(order.status).toBe('paid');
    await expect(page.getByRole('row', { name: new RegExp(`#${order.number}`) })).toBeVisible();
  });

  test('unpaid attempts are hidden until asked for', async ({ page, customer, menuItems }) => {
    await setCart(customer, [{ baseId: menuItems.loaves[0].id, addOnId: null }]);
    await page.goto('/cart');
    await fillCheckout(page);
    await payUntilWhish(page);
    const [order] = await ordersOf(customer);

    await signInAsAdmin(page);
    await expect(page.getByRole('row', { name: new RegExp(`#${order.number}`) })).toHaveCount(0);
    await page.getByRole('link', { name: 'Also show unpaid attempts' }).click();
    const row = page.getByRole('row', { name: new RegExp(`#${order.number}`) });
    await expect(row).toContainText('Not paid');
    await expect(row.getByRole('button', { name: 'Mark done' })).toHaveCount(0);
  });
});
