/**
 * The end-to-end tests' own database: same cluster as development, different
 * name. Tests create customers and orders, and in the live database orders use
 * up real order numbers — so they never run there.
 */
export const TEST_DATABASE = 'bakery_e2e';

export function testDatabaseUri(): string {
  const live = process.env.MONGODB_URI;
  if (!live) throw new Error('MONGODB_URI is not set — the tests need .env.local.');
  const uri = new URL(live);
  uri.pathname = `/${TEST_DATABASE}`;
  return uri.toString();
}
