import type { DatabaseState } from '../config/database';

/** Contract returned by the health service to the health controller. */
export interface HealthReport {
  readonly status: 'ok' | 'degraded';
  readonly service: string;
  readonly apiVersion: string;
  readonly environment: string;
  readonly uptimeSeconds: number;
  readonly timestamp: string;
  readonly dependencies: HealthDependencies;
}

export interface HealthDependencies {
  readonly database: DatabaseState;
}
