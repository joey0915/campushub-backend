import mongoose from 'mongoose';

import { env } from './env';

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

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 5000 });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
