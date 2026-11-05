import { disconnect, dropTestDatabase } from './db';

export default async function globalTeardown() {
  await dropTestDatabase();
  await disconnect();
  console.log('\nTest database emptied.');
}
