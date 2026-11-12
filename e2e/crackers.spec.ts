import { crackerLines, ordersOf, packs, setCart, setCrackers } from './support/db';
import { dollars, expect, signInAsAdmin, test } from './support/fixtures';

/**
 * Cracker packs: a size, the flavors mixed into it, and a quantity. Runs in both
 * passes, on the tests' own database; the one Whish test skips itself when
 * payment is off.
 */

const flavorButton = (page: import('@playwright/test').Page, name: string) =>
  page.locator('#crackers ul button', { hasText: new RegExp(`^${name}$`, 'i') });

test.describe('building a cracker pack', () => {
  test('mix flavors up to the pack’s limit, add it, and an identical pack becomes a quantity of two', async ({
    page,
    customer,
    menuItems,
  }) => {
    const [discovery, sharing] = await packs();
    const [first, second, third] = menuItems.crackers;

    await page.goto('/menu');
    await page.getByRole('tab', { name: 'Crackers' }).click();
    await expect(page.getByRole('heading', { name: 'The Sourdough Crackers' })).toBeVisible();

    // The smaller pack holds only so many flavors; the rest are disabled once it is full.
    await page.locator('[aria-label="Pack size"] button', { hasText: discovery.name }).click();
    await flavorButton(page, first.name).click();
    await flavorButton(page, second.name).click();
    await expect(page.locator('#crackers')).toContainText(`${discovery.maxFlavors} of ${discovery.maxFlavors}`);
    await expect(flavorButton(page, third.name)).toBeDisabled();

    // Switching to the bigger pack frees the rest.
    await page.locator('[aria-label="Pack size"] button', { hasText: sharing.name }).click();
    await expect(flavorButton(page, third.name)).toBeEnabled();
    await flavorButton(page, third.name).click();

    const add = page.getByRole('button', { name: `Add pack — ${dollars(sharing.price)}` });
    await add.click();
    await expect(page.getByRole('status')).toContainText(`Added to your order: ${sharing.name} ${sharing.grams}g`);
    await expect.poll(async () => (await crackerLines(customer)).map((line) => line.quantity)).toEqual([1]);

    // The same three flavors again, picked in a different order: same line.
    for (const flavor of [third, first, second]) await flavorButton(page, flavor.name).click();
    await add.click();
    await expect.poll(async () => (await crackerLines(customer)).map((line) => line.quantity)).toEqual([2]);
    await expect(page.getByRole('link', { name: 'Your order, 2 items' }).first()).toBeVisible();

    // The cart page: quantity, line total, and the stepper.
    await page.goto('/cart');
    const main = page.getByRole('main');
    await expect(main).toContainText(`${sharing.name} ${sharing.grams}g`);
    await expect(main).toContainText(dollars(sharing.price * 2));
    await main.getByRole('button', { name: 'One more' }).click();
    await expect.poll(async () => (await crackerLines(customer)).map((line) => line.quantity)).toEqual([3]);
    await expect(main).toContainText(dollars(sharing.price * 3));
    await main.getByRole('button', { name: 'One fewer' }).click();
    await main.getByRole('button', { name: 'One fewer' }).click();
    await main.getByRole('button', { name: 'One fewer' }).click();
    await expect.poll(async () => (await crackerLines(customer)).length).toBe(0);
    await expect(main).toContainText('Nothing in your order yet.');
  });

  test('tapping flavors needs no account, but adding a pack asks to sign in', async ({ page, menuItems }) => {
    await page.goto('/menu');
    await page.getByRole('tab', { name: 'Crackers' }).click();
    await flavorButton(page, menuItems.crackers[0].name).click();
    await page.getByRole('button', { name: /Add pack/ }).click();
    await page.waitForURL('**/account/login?from=%2Fmenu');
  });

  test('loaves and packs share the cart without disturbing each other', async ({ page, customer, menuItems }) => {
    const [discovery] = await packs();
    await setCart(customer, [{ baseId: menuItems.loaves[0].id, addOnId: null }]);
    await setCrackers(customer, [{ packId: discovery.id, flavorIds: [menuItems.crackers[0].id], quantity: 2 }]);

    await page.goto('/menu');
    // Removing the loaf keeps the pack, and the other way round.
    await page.getByRole('button', { name: `Remove ${menuItems.loaves[0].name} · plain` }).click();
    await expect.poll(async () => (await crackerLines(customer)).length).toBe(1);
    await expect(page.getByRole('link', { name: 'Your order, 2 items' }).first()).toBeVisible();
  });
});

test.describe('the server’s rules for packs', () => {
  test('refuses too many flavors, unknown packs, bad quantities, repeats and non-cracker flavors', async ({
    page,
    customer,
    menuItems,
  }) => {
    expect(customer.id).toBeTruthy();
    const [discovery, sharing] = await packs();
    const flavors = menuItems.crackers.map((flavor) => flavor.id);
    const put = (crackers: unknown[], lines: unknown[] = []) => page.request.put('/api/cart', { data: { lines, crackers } });

    const tooMany = flavors.slice(0, discovery.maxFlavors + 1);
    expect((await put([{ packId: discovery.id, flavorIds: tooMany, quantity: 1 }])).status()).toBe(400);
    expect((await put([{ packId: '000000000000000000000000', flavorIds: [flavors[0]], quantity: 1 }])).status()).toBe(400);
    expect((await put([{ packId: sharing.id, flavorIds: [flavors[0]], quantity: 0 }])).status()).toBe(400);
    expect((await put([{ packId: sharing.id, flavorIds: [flavors[0]], quantity: 21 }])).status()).toBe(400);
    expect((await put([{ packId: sharing.id, flavorIds: [flavors[0], flavors[0]], quantity: 1 }])).status()).toBe(400);
    expect((await put([{ packId: sharing.id, flavorIds: [], quantity: 1 }])).status()).toBe(400);
    // A loaf topping is not a cracker flavor…
    expect((await put([{ packId: sharing.id, flavorIds: [menuItems.toppings[0].id], quantity: 1 }])).status()).toBe(400);
    // …and a cracker flavor cannot be folded through a loaf.
    expect((await put([], [{ baseId: menuItems.loaves[0].id, addOnId: flavors[0] }])).status()).toBe(400);
    // The same pack twice should have been one line with a quantity.
    const same = { packId: sharing.id, flavorIds: [flavors[0], flavors[1]], quantity: 1 };
    expect((await put([same, { ...same, flavorIds: [flavors[1], flavors[0]] }])).status()).toBe(400);

    expect(await crackerLines(customer)).toHaveLength(0);

    // And a valid one is priced by the server, not the request.
    const ok = await put([{ packId: sharing.id, flavorIds: [flavors[0], flavors[1]], quantity: 3 }]);
    expect(ok.status()).toBe(200);
    expect((await ok.json()).cart.totalCents).toBe(sharing.price * 3);
  });
});

test.describe('ordering packs', () => {
  test('a mixed cash order keeps a snapshot of each pack and shows everywhere', async ({
    page,
    customer,
    menuItems,
    browser,
  }) => {
    const [discovery, sharing] = await packs();
    const [salt, classic, third] = menuItems.crackers;
    await setCart(customer, [{ baseId: menuItems.loaves[0].id, addOnId: null }]);
    await setCrackers(customer, [
      { packId: sharing.id, flavorIds: [salt.id, classic.id, third.id], quantity: 2 },
      { packId: discovery.id, flavorIds: [salt.id], quantity: 1 },
    ]);
    const total = menuItems.loaves[0].price + sharing.price * 2 + discovery.price;

    const placed = await page.request.post('/api/orders', { data: { expectedTotalCents: total } });
    expect(placed.status()).toBe(200);
    const { whatsappUrl } = await placed.json();
    const message = decodeURIComponent(whatsappUrl);
    expect(message).toContain(`- ${sharing.name} ${sharing.grams}g (${salt.name} + ${classic.name} + ${third.name}) × 2 = ${dollars(sharing.price * 2)}`);
    expect(message).toContain(`Total: ${dollars(total)}`);

    const [order] = await ordersOf(customer);
    expect(order.totalCents).toBe(total);
    const packLine = order.lines.find((line: { kind?: string; packName?: string }) => line.kind === 'cracker' && line.packName === sharing.name);
    expect(packLine).toMatchObject({ grams: sharing.grams, quantity: 2, unitPriceCents: sharing.price, totalCents: sharing.price * 2 });
    expect(packLine.flavorNames).toEqual([salt.name, classic.name, third.name]);
    expect(await crackerLines(customer)).toHaveLength(0);

    await page.goto(`/orders/${order._id}`);
    const main = page.getByRole('main');
    await expect(main).toContainText(`${sharing.name} ${sharing.grams}g · ${salt.name}, ${classic.name}, ${third.name} × 2`);
    await expect(main).toContainText(`${discovery.name} ${discovery.grams}g · ${salt.name}`);
    await expect(main).toContainText(dollars(total));

    await page.goto('/orders');
    await expect(page.getByRole('link', { name: new RegExp(`Order #${order.number}`) })).toContainText(sharing.name);

    // The bakery sees it in the admin, in a separate session.
    const admin = await browser.newContext();
    const adminPage = await admin.newPage();
    await signInAsAdmin(adminPage);
    const row = adminPage.getByRole('row', { name: new RegExp(`#${order.number}`) });
    await expect(row).toContainText(`${sharing.name} ${sharing.grams}g · ${salt.name}, ${classic.name}, ${third.name} × 2`);
    await expect(row).toContainText('Cash — to bake');
    await admin.close();
  });

  test('a mixed Whish order charges the full total, packs included', async ({ page, customer, menuItems }) => {
    test.skip(process.env.E2E_WHISH !== 'on', 'payment is off in this pass');
    const [, sharing] = await packs();
    await setCart(customer, [{ baseId: menuItems.loaves[0].id, addOnId: null }]);
    await setCrackers(customer, [{ packId: sharing.id, flavorIds: [menuItems.crackers[0].id], quantity: 3 }]);
    const total = menuItems.loaves[0].price + sharing.price * 3;

    await page.goto('/cart');
    await page.locator('#checkout-phone').fill('71 123 456');
    await page.getByRole('button', { name: `Pay ${dollars(total)} with Whish` }).click();
    await page.waitForURL(/\/pay\/\d+$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${(total / 100).toFixed(2)} USD`);

    await page.getByRole('link', { name: /^Approve\s*Marks it paid/ }).click();
    await expect(page.getByRole('heading', { name: 'Thank you — it’s paid' })).toBeVisible();
    const [order] = await ordersOf(customer);
    expect(order.status).toBe('paid');
    expect(order.totalCents).toBe(total);
    expect(await crackerLines(customer)).toHaveLength(0);
  });
});

test.describe('the CMS', () => {
  test('pack prices and limits are edited at /admin/crackers and reach the menu', async ({ page }) => {
    const [discovery] = await packs();
    await signInAsAdmin(page, '/admin/crackers');
    await expect(page.getByRole('heading', { name: 'Crackers' })).toBeVisible();

    const form = page.locator('form', { has: page.locator(`#pack-${discovery.id}-price`) });
    await form.locator(`#pack-${discovery.id}-price`).fill('1.25');
    await form.locator(`#pack-${discovery.id}-max`).fill('3');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form.getByRole('status')).toContainText('Saved');

    await page.goto('/menu');
    const card = page.locator('[aria-label="Pack size"] button', { hasText: discovery.name });
    await expect(card).toContainText('$1.25');
    await expect(card).toContainText('Mix up to 3 flavors');

    // Put it back for the rest of the run.
    await page.goto('/admin/crackers');
    await form.locator(`#pack-${discovery.id}-price`).fill((discovery.price / 100).toFixed(2));
    await form.locator(`#pack-${discovery.id}-max`).fill(String(discovery.maxFlavors));
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form.getByRole('status')).toContainText('Saved');
  });

  test('a cracker flavor has no price field of its own', async ({ page }) => {
    await signInAsAdmin(page, '/admin/products/new');
    await page.locator('#category').selectOption('cracker');
    await expect(page.locator('#price')).toHaveCount(0);
    await expect(page.getByText('customers pay per pack')).toBeVisible();
  });
});

test.describe('saving products with nothing in the optional fields', () => {
  test('a cracker flavor saves with an empty description — the reported failure — and with no photo', async ({ page }) => {
    await signInAsAdmin(page, '/admin/products');
    const row = page.getByRole('row', { name: /Salt/ }).filter({ hasText: 'per pack' });
    await row.getByRole('link', { name: 'Edit' }).click();
    await page.waitForURL('**/admin/products/*/edit');

    // Every cracker flavor starts with an empty description.
    await expect(page.locator('#description')).toHaveValue('');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForURL('**/admin/products');
    await expect(page.getByText('Could not save the product.')).toHaveCount(0);

    // And the API agrees, for both optional fields at once.
    const id = (await page.request.get('/api/products').then((r) => r.json())).products.find(
      (p: { name: string; category: string }) => p.name === 'Salt' && p.category === 'cracker',
    ).id;
    const saved = await page.request.patch(`/api/products/${id}`, { data: { description: '', imageUrl: '' } });
    expect(saved.status()).toBe(200);
    expect((await saved.json()).product).toMatchObject({ description: '', imageUrl: '' });
  });

  test('a new product can be created without a description or photo', async ({ page }) => {
    await signInAsAdmin(page, '/admin/products');
    const created = await page.request.post('/api/products', {
      data: { name: 'Test flavor', category: 'cracker', description: '', price: 0, imageUrl: '', sortOrder: 200 },
    });
    expect(created.status()).toBe(201);
    const { product } = await created.json();
    expect((await page.request.delete(`/api/products/${product.id}`)).status()).toBe(200);
  });
});
