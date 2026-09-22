import type { Request, Response } from 'express';

import { healthService } from '../services/health.service';
import type { HealthReport } from '../types/health.types';

/**
 * HTTP boundary for the health check: calls the service and maps the result to
 * a status code. No database access and no business rules here (AGENTS.md §3).
 *
 * This is a *liveness* check, so a reachable process always answers 200; a
 * dependency that is down is reported as `status: "degraded"` in the body
 * rather than by failing the request.
 */
export const healthController = {
  // Arrow properties so handlers stay safe to pass to a router unbound.
  getHealth: (_req: Request, res: Response): void => {
    const report: HealthReport = healthService.getHealthReport();

    res.status(200).json(report);
  },
} as const;
