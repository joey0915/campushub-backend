import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Starts the in-memory MongoDB once per run. `src/config/env.ts` reads
 * MONGODB_URI when it is first imported, so the URI has to be in the
 * environment before any test worker loads the app; this harness is the one
 * sanctioned writer of `process.env` (AGENTS.md §4). dotenv never overrides a
 * variable that is already set, so a developer's `.env` cannot redirect the
 * tests to a real database.
 */
export default async function globalSetup(): Promise<void> {
  const server = await MongoMemoryServer.create();
  globalThis.campushubMemoryServer = server;
  process.env['MONGODB_URI'] = server.getUri();
}
