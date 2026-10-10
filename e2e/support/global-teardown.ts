import { disconnect, removeTestData } from './db';

export default async function globalTeardown() {
  const removed = await removeTestData();
  await disconnect();
  console.log(
    `\nTest data removed: ${removed.customers} customers, ${removed.orders} orders, ` +
      `${removed.carts} carts, ${removed.codes} sign-in codes.`,
  );
}
