import { Types } from 'mongoose';

import { ReservationModel, type ReservationEntity } from '../models/Reservation.model';
import { ResourceModel } from '../models/Resource.model';
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
    id: entity._id.toHexString(),
    resourceId: entity.resourceId.toHexString(),
    userId: entity.userId,
    startTime: entity.startTime.toISOString(),
    endTime: entity.endTime.toISOString(),
    status: entity.status,
  };
}

/**
 * Reservation business rules and their data access, through the Mongoose
 * models: a reservation must name an existing resource and a slot that no
 * active reservation overlaps. Failures are thrown as typed AppErrors; no
 * Express or HTTP knowledge here (AGENTS.md §3, §4).
 */
export const reservationService = {
  async createReservation(
    tenantId: string,
    request: CreateReservationRequest,
  ): Promise<Reservation> {
    const resourceId = new Types.ObjectId(request.resourceId);
    const startTime = new Date(request.startTime);
    const endTime = new Date(request.endTime);

    // The lab defines only 201/400/409/500 for this operation, so a reference to
    // a resource that does not exist is an invalid field (400), not a 404.
    const resourceExists = await ResourceModel.exists({ _id: resourceId, tenantId }).exec();
    if (resourceExists === null) {
      throw new ValidationError(
        `resourceId ${request.resourceId} does not refer to an existing resource.`,
      );
    }

    // Half-open intervals: a slot may start exactly when another ends. Check and
    // insert are two queries, so two simultaneous requests could both pass the
    // check; closing that gap needs a transaction (a replica set) or a lock.
    const overlap = await ReservationModel.exists({
      tenantId,
      resourceId,
      status: { $in: ACTIVE_STATUSES },
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    }).exec();
    if (overlap !== null) {
      throw new ConflictError('Resource is already reserved for this time slot.', 'DOUBLE_BOOKING');
    }

    const created = await ReservationModel.create({
      tenantId,
      resourceId,
      userId: request.userId,
      startTime,
      endTime,
      status: 'PENDING',
    });
    return toReservation(created.toObject<ReservationEntity>());
  },

  async listActiveReservationsForUser(tenantId: string, userId: string): Promise<Reservation[]> {
    const reservations = await ReservationModel.find({
      tenantId,
      userId,
      status: { $in: ACTIVE_STATUSES },
    })
      .sort({ startTime: 1, _id: 1 })
      .lean<ReservationEntity[]>()
      .exec();
    return reservations.map(toReservation);
  },
} as const;
