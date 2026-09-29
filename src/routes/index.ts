import { Router } from 'express';

import { healthRouter } from './health.routes';
import { reservationRouter } from './reservation.routes';

/** Aggregates every feature router mounted under `/api/<version>`. */
const apiRouter: Router = Router();

apiRouter.use(healthRouter);
apiRouter.use(reservationRouter);

export { apiRouter };
