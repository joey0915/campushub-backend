/** Stops the in-memory MongoDB that global-setup.ts started. */
export default async function globalTeardown(): Promise<void> {
  const server = globalThis.campushubMemoryServer;
  if (server === undefined) {
    throw new Error('globalTeardown ran without a memory server from globalSetup.');
  }
  await server.stop();
  globalThis.campushubMemoryServer = undefined;
}
