import { hash } from 'bcryptjs';
import mongoose from 'mongoose';
import { CUSTOMER_COOKIE, signSession } from '../../lib/jwt';
import { seedCatalogue } from '../../lib/seed-catalogue';
import { TEST_DATABASE, testDatabaseUri } from './test-db';

/**
 * Direct database access for the tests — always the tests' own database
 * (bakery_e2e), never the one the live site uses. Customers still get
 * addresses under TEST_DOMAIN, so anything that did leak would be obvious.
 */
export const TEST_DOMAIN = 'e2e.labellefournee.test';

let connecting: Promise<typeof mongoose> | null = null;

export async function db() {
  connecting ??= mongoose.connect(testDatabaseUri());
  await connecting;
  const database = mongoose.connection.db!;
  // The one check that matters most in this file: everything below writes and
  // deletes freely, which is only acceptable in the test database.
  if (database.databaseName !== TEST_DATABASE) {
    throw new Error(`Refusing to run tests against "${database.databaseName}".`);
  }
  return database;
}

export async function disconnect() {
  if (connecting) await mongoose.disconnect();
  connecting = null;
}

export function testEmail(label: string): string {
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `${label}-${unique}@${TEST_DOMAIN}`;
}

export type TestCustomer = { id: string; email: string };

export async function createCustomer(label = 'customer'): Promise<TestCustomer> {
  const email = testEmail(label);
  const now = new Date();
  const result = await (await db())
    .collection('customers')
    .insertOne({ email, name: '', lastLoginAt: now, createdAt: now, updatedAt: now });
  return { id: result.insertedId.toString(), email };
}

/** A session cookie for that customer, signed exactly as the site signs its own. */
export async function sessionCookie(customer: TestCustomer, baseURL: string) {
  const value = await signSession({ sub: customer.id, role: 'customer', email: customer.email });
  return { name: CUSTOMER_COOKIE, value, url: baseURL, httpOnly: true, sameSite: 'Lax' as const };
}

/**
 * Sign-in codes are emailed and stored only as a hash, so a test cannot read
 * one. Instead it swaps the hash of the newest code for one it knows.
 */
export async function plantSignInCode(email: string, code: string): Promise<void> {
  const tokens = (await db()).collection('otptokens');
  const latest = await tokens.findOne({ email, consumedAt: null }, { sort: { createdAt: -1 } });
  if (!latest) throw new Error(`No sign-in code was issued for ${email}.`);
  await tokens.updateOne({ _id: latest._id }, { $set: { codeHash: await hash(code, 4) } });
}

export type MenuItem = { id: string; name: string; price: number };

/**
 * The test database's menu: loaves, toppings (savory and sweet) and cracker
 * flavors, each in menu order. Cracker flavors are not toppings, and the two
 * must never be mixed up — a cracker cannot go on a loaf.
 */
export async function menu(): Promise<{ loaves: MenuItem[]; toppings: MenuItem[]; crackers: MenuItem[] }> {
  const products = await (await db()).collection('products').find({}).sort({ sortOrder: 1 }).toArray();
  const pick = (categories: string[]) =>
    products
      .filter((p) => categories.includes(p.category))
      .map((p) => ({ id: p._id.toString(), name: p.name as string, price: p.price as number }));
  const loaves = pick(['base']);
  const toppings = pick(['savory', 'sweet']);
  const crackers = pick(['cracker']);
  if (loaves.length < 1 || toppings.length < 1) {
    throw new Error('The menu needs at least one loaf and one topping for these tests.');
  }
  return { loaves, toppings, crackers };
}

export type PackItem = { id: string; name: string; grams: number; price: number; maxFlavors: number };

export async function packs(): Promise<PackItem[]> {
  const docs = await (await db()).collection('crackerpacks').find({}).sort({ sortOrder: 1 }).toArray();
  return docs.map((p) => ({
    id: p._id.toString(),
    name: p.name as string,
    grams: p.grams as number,
    price: p.price as number,
    maxFlavors: p.maxFlavors as number,
  }));
}

export async function setCart(
  customer: TestCustomer,
  lines: { baseId: string; addOnId: string | null }[],
): Promise<void> {
  const id = new mongoose.Types.ObjectId(customer.id);
  await (await db()).collection('carts').updateOne(
    { customerId: id },
    {
      $set: {
        lines: lines.map((line) => ({
          base: new mongoose.Types.ObjectId(line.baseId),
          addOn: line.addOnId ? new mongoose.Types.ObjectId(line.addOnId) : null,
        })),
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
}

export async function setCrackers(
  customer: TestCustomer,
  crackers: { packId: string; flavorIds: string[]; quantity: number }[],
): Promise<void> {
  const id = new mongoose.Types.ObjectId(customer.id);
  await (await db()).collection('carts').updateOne(
    { customerId: id },
    {
      $set: {
        crackers: crackers.map((line) => ({
          pack: new mongoose.Types.ObjectId(line.packId),
          flavors: line.flavorIds.map((flavor) => new mongoose.Types.ObjectId(flavor)),
          quantity: line.quantity,
        })),
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date(), lines: [] },
    },
    { upsert: true },
  );
}

export async function crackerLines(customer: TestCustomer) {
  const cart = await (await db())
    .collection('carts')
    .findOne({ customerId: new mongoose.Types.ObjectId(customer.id) });
  return (cart?.crackers ?? []) as { pack: unknown; flavors: unknown[]; quantity: number }[];
}

export async function cartLineCount(customer: TestCustomer): Promise<number> {
  const cart = await (await db())
    .collection('carts')
    .findOne({ customerId: new mongoose.Types.ObjectId(customer.id) });
  return cart?.lines?.length ?? 0;
}

export async function ordersOf(customer: TestCustomer) {
  return (await db())
    .collection('orders')
    .find({ customerId: new mongoose.Types.ObjectId(customer.id) })
    .sort({ number: 1 })
    .toArray();
}

/**
 * Empties every collection in the test database. Not dropDatabase(): the Atlas
 * user is not allowed to drop databases (rightly), and emptying keeps the
 * indexes — one order per number, one customer per email — that the app relies on.
 */
async function emptyTestDatabase(): Promise<void> {
  const database = await db();
  for (const collection of await database.collections()) {
    await collection.deleteMany({});
  }
}

/**
 * Wipes the test database and seeds a fresh menu, cracker packs and admin user
 * into it. Run before every test run.
 */
export async function resetTestDatabase(): Promise<void> {
  await emptyTestDatabase();
  await seedCatalogue({
    adminUsername: process.env.ADMIN_USERNAME,
    adminPassword: process.env.ADMIN_PASSWORD,
  });
}

/** Empties the test database once a run is over. */
export async function dropTestDatabase(): Promise<void> {
  await emptyTestDatabase();
}
