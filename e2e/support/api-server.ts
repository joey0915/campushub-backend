import { spawn } from 'node:child_process';

import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Playwright's API web server: an in-memory MongoDB, reset by `npm run seed`,
 * behind the real `src/server.ts`. Like the Jest harness, it writes
 * MONGODB_URI before any child loads `src/config/env.ts` (AGENTS.md §4), and
 * dotenv never overrides it, so a developer's `.env` cannot point the E2E run
 * at a real database.
 */
function run(command: string, args: readonly string[]): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', resolve);
  });
}

async function main(): Promise<void> {
  const mongo = await MongoMemoryServer.create();
  process.env['MONGODB_URI'] = mongo.getUri('campushub-e2e');

  // Playwright signals the whole process group, so the API child stops on its own.
  const stop = (): void => {
    mongo.stop().catch((error: unknown) => {
      console.error('[e2e-api] Failed to stop MongoDB:', error);
    });
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  const seedExit = await run('npm', ['run', 'seed']);
  if (seedExit !== 0) {
    throw new Error(`npm run seed exited with ${String(seedExit)}`);
  }
  await run('npx', ['ts-node', 'src/server.ts']);
  await mongo.stop();
}

main().catch((error: unknown) => {
  console.error('[e2e-api] Failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
