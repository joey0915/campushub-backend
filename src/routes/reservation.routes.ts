import { Router } from 'express';

import { reservationController } from '../controllers/reservation.controller';
import { resourceController } from '../controllers/resource.controller';
import { asyncHandler } from '../utils/async-handler';

/**
 * Route wiring for the CampusHub Reservation API contract (docs/openapi.yaml):
 * one line per contract operation, delegating to its controller (AGENTS.md §3).
 * Paths are relative to the `/api/v1` mount point, the contract's server URL.
 */
const reservationRouter: Router = Router();

reservationRouter.get('/resources', asyncHandler(resourceController.listResources));
reservationRouter.post('/reservations', asyncHandler(reservationController.createReservation));
reservationRouter.get(
  '/reservations/user/:userId',
  asyncHandler(reservationController.listUserReservations),
);

export { reservationRouter };
