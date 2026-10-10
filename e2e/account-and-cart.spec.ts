import { cartLineCount, createCustomer, plantSignInCode, sessionCookie, testEmail } from './support/db';
import { dollars, expect, test } from './support/fixtures';

test.describe('signing in with an emailed code', () => {
  test('a new address signs up, lands where it was headed, and can sign out', async ({ page }) => {
    const email = testEmail('signup');
    await page.goto('/account/login?from=/cart');

    await page.locator('#email').fill(email);
    await page.getByRole('button', { name: /send me a code/i }).click();
    await expect(page.getByText(`We sent a 6-digit code to ${email}.`)).toBeVisible();

    await plantSignInCode(email, '424242');

    await page.locator('#code').fill('000000');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText(/Incorrect code/)).toBeVisible();

    await page.locator('#code').fill('424242');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await page.waitForURL('**/cart');
    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

    // Wait for the sign-out to finish before navigating, or the next page
    // load races it and still carries the session.
    await Promise.all([
      page.waitForResponse((response) => response.url().endsWith('/api/account/logout')),
      page.getByRole('main').getByRole('button', { name: 'Sign out' }).click(),
    ]);
    await page.goto('/cart');
    await expect(page).toHaveURL(/\/account\/login/);
  });

  test('a malformed address is refused', async ({ request }) => {
    const response = await request.post('/api/account/request-code', { data: { email: 'not-an-email' } });
    expect(response.status()).toBe(400);
  });
});

test.describe('building an order', () => {
  test('toppings go on a chosen loaf, plain loaves count once, and the cart follows', async ({
    page,
    customer,
    menuItems,
  }) => {
    const [loaf, otherLoaf = loaf] = menuItems.loaves;
    const topping = menuItems.toppings[0];
    await page.goto('/menu');
    const main = page.getByRole('main');

    // A topping on a loaf.
    const card = main.locator('article', { has: page.getByRole('heading', { name: topping.name, exact: true }) });
    await card.getByRole('button', { name: new RegExp(`^${loaf.name}`) }).click();
    await expect(card.getByRole('button', { name: new RegExp(`^${loaf.name}`) })).toHaveAttribute('aria-pressed', 'true');
    await expect(card).toContainText(`In your order · ${dollars(topping.price + loaf.price)}`);

    // Choosing the other loaf moves the topping; it is never ordered twice.
    if (otherLoaf.id !== loaf.id) {
      await card.getByRole('button', { name: new RegExp(`^${otherLoaf.name}`) }).click();
      await expect(card.getByRole('button', { name: new RegExp(`^${loaf.name}`) })).toHaveAttribute('aria-pressed', 'false');
      await expect(card).toContainText(`In your order · ${dollars(topping.price + otherLoaf.price)}`);
    }

    // A plain loaf.
    const loafCard = main.locator('article', { has: page.getByRole('heading', { name: loaf.name, exact: true }) });
    await loafCard.getByRole('button', { name: 'Add plain loaf' }).click();
    await expect(loafCard.getByRole('button', { name: 'Plain loaf added' })).toBeVisible();

    const total = topping.price + otherLoaf.price + loaf.price;
    await expect(page.getByText('Total').last().locator('..')).toContainText(dollars(total));
    await expect(page.getByRole('link', { name: 'Your order, 2 items' }).first()).toBeVisible();
    await expect.poll(() => cartLineCount(customer)).toBe(2);

    // The cart page shows the same order, and it survives a reload.
    await page.goto('/cart');
    await expect(page.getByText(`${topping.name} on ${otherLoaf.name}`)).toBeVisible();
    await expect(page.getByText(`${loaf.name}, plain`)).toBeVisible();
    await expect(page.getByRole('main')).toContainText(dollars(total));

    await page.getByRole('button', { name: `Remove plain ${loaf.name}` }).click();
    await expect(page.getByText(`${loaf.name}, plain`)).toBeHidden();
    await expect.poll(() => cartLineCount(customer)).toBe(1);
    await page.reload();
    await expect(page.getByText(`${topping.name} on ${otherLoaf.name}`)).toBeVisible();
    await expect(page.getByText(`${loaf.name}, plain`)).toBeHidden();
  });

  test('the server refuses the same topping twice and unknown products', async ({ page, customer, menuItems }) => {
    expect(customer.id).toBeTruthy();
    const [loaf, otherLoaf = loaf] = menuItems.loaves;
    const topping = menuItems.toppings[0];

    const twice = await page.request.put('/api/cart', {
      data: {
        lines: [
          { baseId: loaf.id, addOnId: topping.id },
          { baseId: otherLoaf.id, addOnId: topping.id },
        ],
      },
    });
    expect(twice.status()).toBe(400);

    const swapped = await page.request.put('/api/cart', { data: { lines: [{ baseId: topping.id, addOnId: null }] } });
    expect(swapped.status()).toBe(400);

    const unknown = await page.request.put('/api/cart', {
      data: { lines: [{ baseId: '000000000000000000000000', addOnId: null }] },
    });
    expect(unknown.status()).toBe(400);
  });

  test('one customer cannot see another customer’s cart', async ({ page, customer, menuItems, browser, baseURL }) => {
    await page.request.put('/api/cart', { data: { lines: [{ baseId: menuItems.loaves[0].id, addOnId: null }] } });
    await expect.poll(() => cartLineCount(customer)).toBe(1);

    const other = await createCustomer('other');
    const context = await browser.newContext();
    await context.addCookies([await sessionCookie(other, baseURL!)]);
    const response = await context.request.get(`${baseURL}/api/cart`);
    expect((await response.json()).cart.lines).toHaveLength(0);
    await context.close();
  });
});
