import type { ReservationEntity } from '../models/reservation.model';
import { reservationRepository } from '../repositories/reservation.repository';
import { resourceRepository } from '../repositories/resource.repository';
import type {
  CreateReservationRequest,
  Reservation,
  ReservationStatus,
} from '../types/reservation';
import { ConflictError, ValidationError } from '../utils/app-error';

/**
 * Statuses that hold a time slot: what "active" means for a student's
 * reservations, and the only ones that block an overlapping request.
 */
const ACTIVE_STATUSES: readonly ReservationStatus[] = ['PENDING', 'CONFIRMED'];

// Explicit field mapping is what keeps the internal tenantId out of responses.
function toReservation(entity: ReservationEntity): Reservation {
  return {
    id: entity._id,
    resourceId: entity.resourceId,
    userId: entity.userId,
    startTime: entity.startTime.toISOString(),
    endTime: entity.endTime.toISOString(),
    status: entity.status,
  };
}

/**
 * Reservation business rules: a reservation must name an existing resource
 * and a slot that no active reservation overlaps. Failures are thrown as typed
 * AppErrors; no Express or HTTP knowledge here (AGENTS.md §3, §4).
 */
export const reservationService = {
  async createReservation(
    tenantId: string,
    request: CreateReservationRequest,
  ): Promise<Reservation> {
    // The lab defines only 201/400/409/500 for this operation, so a reference to
    // a resource that does not exist is an invalid field (400), not a 404.
    const resource = await resourceRepository.findById(tenantId, request.resourceId);
    if (resource === undefined) {
      throw new ValidationError(
        `resourceId ${request.resourceId} does not refer to an existing resource.`,
      );
    }

    const created = await reservationRepository.insertIfNoOverlap(
      {
        tenantId,
        resourceId: request.resourceId,
        userId: request.userId,
        startTime: new Date(request.startTime),
        endTime: new Date(request.endTime),
        status: 'PENDING',
      },
      ACTIVE_STATUSES,
    );
    if (created === undefined) {
      throw new ConflictError('Resource is already reserved for this time slot.', 'DOUBLE_BOOKING');
    }
    return toReservation(created);
  },

  async listActiveReservationsForUser(tenantId: string, userId: string): Promise<Reservation[]> {
    const reservations = await reservationRepository.findByUser(tenantId, userId, ACTIVE_STATUSES);
    return reservations.map(toReservation);
  },
} as const;
