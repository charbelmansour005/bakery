import type { BrowserContext } from '@playwright/test';
import { cartLineCount, createCustomer, ordersOf, sessionCookie, setCart } from './support/db';
import { dollars, expect, pickupInDays, signInAsAdmin, test } from './support/fixtures';

/**
 * Cash on delivery, and the order history it feeds. Runs in both passes: a cash
 * order does not depend on Whish being switched on.
 */

/** Catches the WhatsApp tab instead of loading WhatsApp, and reports where it was headed. */
async function catchWhatsApp(context: BrowserContext): Promise<() => string> {
  let opened = '';
  await context.route(/wa\.me|whatsapp\.com/, (route) => {
    opened ||= decodeURIComponent(route.request().url());
    return route.abort();
  });
  return () => opened;
}

test.describe('cash on delivery', () => {
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

  test('one tap in the dialog saves the order, opens WhatsApp and empties the cart', async ({
    page,
    context,
    customer,
    menuItems,
  }) => {
    const [loaf] = menuItems.loaves;
    const [topping] = menuItems.toppings;
    const whatsapp = await catchWhatsApp(context);

    await page.goto('/menu');
    await page.getByRole('button', { name: 'Review Order' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Cash on delivery/ }).click();

    await page.waitForURL('**/orders/*');
    const [order] = await ordersOf(customer);
    expect(order.status).toBe('placed');
    expect(order.paymentMethod).toBe('cash');
    expect(order.totalCents).toBe(total);
    expect(page.url()).toContain(`/orders/${order._id}`);

    // WhatsApp was opened with this very order written out.
    await expect.poll(whatsapp).toContain('https://wa.me/96171862139');
    expect(whatsapp()).toContain(`I placed order #${order.number}, cash on delivery.`);
    expect(whatsapp()).toContain(topping.name);
    expect(whatsapp()).toContain(`Total: ${dollars(total)}`);

    const main = page.getByRole('main');
    await expect(page.getByRole('heading', { name: 'Your order is placed' })).toBeVisible();
    await expect(main).toContainText(`Order #${order.number}`);
    await expect(main).toContainText(`${topping.name} on ${loaf.name}`);
    await expect(main).toContainText('Total due on delivery');
    await expect(main).toContainText(dollars(total));
    await expect(main).toContainText('To be arranged');
    // A cash order is never a test payment, whatever mode Whish is in.
    await expect(page.getByText('Test payment')).toHaveCount(0);
    await expect(main.getByRole('link', { name: 'Send my order on WhatsApp' })).toHaveAttribute(
      'href',
      /wa\.me\/96171862139/,
    );

    expect(await cartLineCount(customer)).toBe(0);
    await expect(page.getByRole('link', { name: 'Your order, empty' }).first()).toBeVisible();
  });

  test('the order shows in “My orders”, reached from the nav', async ({ page, context, customer }) => {
    await catchWhatsApp(context);
    const placed = await page.request.post('/api/orders', { data: { expectedTotalCents: total } });
    expect(placed.status()).toBe(200);
    const [order] = await ordersOf(customer);

    await page.goto('/');
    await page.getByRole('banner').getByRole('link', { name: 'My orders' }).click();
    await page.waitForURL('**/orders');

    await expect(page.getByRole('heading', { name: 'My orders' })).toBeVisible();
    const entry = page.getByRole('link', { name: new RegExp(`Order #${order.number}`) });
    await expect(entry).toContainText('Cash on delivery');
    await expect(entry).toContainText(dollars(total));

    await entry.click();
    await page.waitForURL(`**/orders/${order._id}`);
    await expect(page.getByRole('heading', { name: 'Your order is placed' })).toBeVisible();
  });

  test('the phone menu carries the same link', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/menu');
    await page.getByRole('banner').getByRole('button', { name: /menu/i }).click();
    await page.getByRole('banner').getByRole('link', { name: 'My orders' }).click();
    await page.waitForURL('**/orders');
    await expect(page.getByText('No orders yet.')).toBeVisible();
  });

  test('the bakery sees a cash order and can mark it done', async ({ page, customer, menuItems }) => {
    const placed = await page.request.post('/api/orders', {
      data: { phone: '03 123 456', pickupDate: pickupInDays(3), note: 'Ring twice', expectedTotalCents: total },
    });
    expect(placed.status()).toBe(200);
    const [order] = await ordersOf(customer);
    expect(order.phone).toBe('03123456');

    await signInAsAdmin(page);
    const row = page.getByRole('row', { name: new RegExp(`#${order.number}`) });
    await expect(row).toContainText('Cash — to bake');
    await expect(row).toContainText(customer.email);
    await expect(row).toContainText('03123456');
    await expect(row).toContainText('Ring twice');
    await expect(row).toContainText(`${menuItems.loaves[0].name}, plain`);

    await row.getByRole('button', { name: 'Mark done' }).click();
    await expect(row).toContainText('Done');
    expect((await ordersOf(customer))[0].fulfilledAt).toBeTruthy();
  });

  test('the server builds the order itself and refuses a wrong total or bad details', async ({ page, customer }) => {
    const send = (data: Record<string, unknown>) =>
      page.request.post('/api/orders', { data: { expectedTotalCents: total, ...data } });

    expect((await send({ expectedTotalCents: 1 })).status()).toBe(409);
    expect((await send({ phone: 'call me' })).status()).toBe(400);
    expect((await send({ pickupDate: pickupInDays(0) })).status()).toBe(400);
    expect((await send({ note: 'x'.repeat(301) })).status()).toBe(400);
    expect(await ordersOf(customer)).toHaveLength(0);
    expect(await cartLineCount(customer)).toBe(2);

    await setCart(customer, []);
    expect((await send({ expectedTotalCents: 0 })).status()).toBe(400);
  });

  test('orders belong to their customer, and signed-out requests are refused', async ({
    page,
    customer,
    browser,
    baseURL,
    request,
  }) => {
    await page.request.post('/api/orders', { data: { expectedTotalCents: total } });
    const [order] = await ordersOf(customer);

    expect((await request.post('/api/orders', { data: { expectedTotalCents: total } })).status()).toBe(401);

    const stranger = await createCustomer('stranger');
    const context = await browser.newContext();
    await context.addCookies([await sessionCookie(stranger, baseURL!)]);
    const other = await context.newPage();
    expect((await other.goto(`${baseURL}/orders/${order._id}`))!.status()).toBe(404);
    await other.goto(`${baseURL}/orders`);
    await expect(other.getByText('No orders yet.')).toBeVisible();
    await context.close();
  });

  test('the Whish callback cannot touch a cash order', async ({ page, customer }) => {
    await page.request.post('/api/orders', { data: { expectedTotalCents: total } });
    const [order] = await ordersOf(customer);

    await page.request.get(`/api/whish/callback?order=${order._id}&t=${order.callbackToken}&result=failure`);
    const [after] = await ordersOf(customer);
    expect(after.status).toBe('placed');
    expect(after.paidAt).toBeNull();
  });
});
