import { hash } from 'bcryptjs';
import mongoose from 'mongoose';
import { CUSTOMER_COOKIE, signSession } from '../../lib/jwt';

/**
 * Direct database access for the tests.
 *
 * Local development and production share one database, so everything here is
 * scoped to addresses under TEST_DOMAIN. Nothing else is ever read for
 * deletion, and global-teardown removes all of it.
 */
export const TEST_DOMAIN = 'e2e.labellefournee.test';

let connecting: Promise<typeof mongoose> | null = null;

export async function db() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set — the tests need .env.local.');
  connecting ??= mongoose.connect(uri);
  await connecting;
  return mongoose.connection.db!;
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

/** Two loaves and two toppings from the live menu, whatever it holds today. */
export async function menu(): Promise<{ loaves: MenuItem[]; toppings: MenuItem[] }> {
  const products = await (await db()).collection('products').find({}).sort({ sortOrder: 1 }).toArray();
  const pick = (base: boolean) =>
    products
      .filter((p) => (p.category === 'base') === base)
      .map((p) => ({ id: p._id.toString(), name: p.name as string, price: p.price as number }));
  const loaves = pick(true);
  const toppings = pick(false);
  if (loaves.length < 1 || toppings.length < 1) {
    throw new Error('The menu needs at least one loaf and one topping for these tests.');
  }
  return { loaves, toppings };
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

/** Removes every trace of the test customers. Safe to run at any time. */
export async function removeTestData(): Promise<Record<string, number>> {
  const database = await db();
  const pattern = new RegExp(`@${TEST_DOMAIN.replace(/\./g, '\\.')}$`);
  const customers = await database.collection('customers').find({ email: pattern }).toArray();
  const ids = customers.map((c) => c._id);

  const orders = await database.collection('orders').deleteMany({ customerId: { $in: ids } });
  const carts = await database.collection('carts').deleteMany({ customerId: { $in: ids } });
  const codes = await database.collection('otptokens').deleteMany({ email: pattern });
  const removed = await database.collection('customers').deleteMany({ email: pattern });

  // Only the mock ever saw these order numbers. If no order of any kind is
  // left, the sequence can start clean; once real orders exist it is left alone.
  if ((await database.collection('orders').countDocuments({})) === 0) {
    await database.collection('counters').deleteOne({ _id: 'order' as never });
  }

  return {
    customers: removed.deletedCount,
    orders: orders.deletedCount,
    carts: carts.deletedCount,
    codes: codes.deletedCount,
  };
}
