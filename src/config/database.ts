import os from 'node:os';

import mongoose from 'mongoose';

/**
 * Mongoose connection lifecycle and connection-state reporting.
 *
 * This is infrastructure, not a model query: services may read the connection
 * state from here for diagnostics without violating the "no database access
 * outside models" boundary (AGENTS.md §3).
 */
export type DatabaseState =
  'disconnected' | 'connected' | 'connecting' | 'disconnecting' | 'unknown';

const READY_STATE_LABELS: Readonly<Record<number, DatabaseState>> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
} as const;

export function getDatabaseState(): DatabaseState {
  return READY_STATE_LABELS[mongoose.connection.readyState] ?? 'unknown';
}

export async function connectDatabase(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);
  // mongodb >= 7.6 loads `os` through a dynamic import() that Jest's CommonJS sandbox rejects,
  // and then sends an empty handshake the server refuses (NODE-7832). Passing it explicitly
  // takes the same value in production and lets the test suite connect.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, runtimeAdapters: { os } });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
