import { disconnect, resetTestDatabase } from './db';

/** A fresh test database for every run: wiped, then seeded. */
export default async function globalSetup() {
  await resetTestDatabase();
  await disconnect();
}
