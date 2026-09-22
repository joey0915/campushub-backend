import { Router } from 'express';

import { healthController } from '../controllers/health.controller';

/**
 * Route wiring only: path, verb, and the controller it delegates to
 * (AGENTS.md §3). No logic, no inline handlers.
 */
const healthRouter: Router = Router();

healthRouter.get('/health', healthController.getHealth);

export { healthRouter };
