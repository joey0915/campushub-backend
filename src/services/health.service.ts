import { getDatabaseState } from '../config/database';
import { env } from '../config/env';
import type { HealthReport } from '../types/health.types';

const SERVICE_NAME = 'campushub-backend' as const;

/**
 * Business logic for the health check. Knows nothing about Express, `req`,
 * `res`, or HTTP status codes — the controller owns that translation
 * (AGENTS.md §3).
 */
export const healthService = {
  getHealthReport(): HealthReport {
    const database = getDatabaseState();

    return {
      status: database === 'connected' ? 'ok' : 'degraded',
      service: SERVICE_NAME,
      apiVersion: env.apiVersion,
      environment: env.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      dependencies: { database },
    };
  },
} as const;
