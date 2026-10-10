import { disconnect, removeTestData } from './db';

/** Start from a clean slate, in case an earlier run was interrupted. */
export default async function globalSetup() {
  await removeTestData();
  await disconnect();
}
