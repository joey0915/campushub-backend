import type { MongoMemoryServer } from 'mongodb-memory-server';

// The slot global-setup.ts fills and global-teardown.ts empties; Jest runs both in one context
// and shares only globals between them.
declare global {
  var campushubMemoryServer: MongoMemoryServer | undefined;
}

export {};
