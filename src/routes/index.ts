import { Router } from 'express';

import { healthRouter } from './health.routes';

/** Aggregates every feature router mounted under `/api/<version>`. */
const apiRouter: Router = Router();

apiRouter.use(healthRouter);

export { apiRouter };
