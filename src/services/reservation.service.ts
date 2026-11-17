import { Types } from 'mongoose';

import { ReservationModel, type ReservationEntity } from '../models/Reservation.model';
import { ResourceModel, type ResourceEntity } from '../models/Resource.model';
import {
  ACTIVE_RESERVATION_STATUSES,
  type CreateReservationRequest,
  type Reservation,
  type ReservationStatus,
} from '../types/reservation';
import { ConflictError, NotFoundError, ValidationError } from '../utils/app-error';

/** The lifecycle: each target status and the statuses a reservation may reach it from. */
const ALLOWED_TRANSITIONS = {
  CONFIRMED: ['PENDING'],
  CANCELLED: ['PENDING', 'CONFIRMED'],
} as const satisfies Readonly<Partial<Record<ReservationStatus, readonly ReservationStatus[]>>>;
type TargetStatus = keyof typeof ALLOWED_TRANSITIONS;

/** How often one booking retries after losing a race to a concurrent booking of its resource. */
const MAX_BOOKING_ATTEMPTS = 25;

/** The requested slot, already converted to the types the models store. */
interface SlotRequest {
  readonly resourceId: Types.ObjectId;
  readonly startTime: Date;
  readonly endTime: Date;
}

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

    for (let attempt = 1; attempt <= MAX_BOOKING_ATTEMPTS; attempt += 1) {
      const created = await tryBookSlot(tenantId, request, { resourceId, startTime, endTime });
      if (created !== undefined) {
        return created;
      }
    }
    // Every lost attempt means another booking of this resource committed, so this is only
    // reachable under sustained contention; the contract has no 409 code for it.
    throw new Error(
      `Booking resource ${request.resourceId} lost ${String(MAX_BOOKING_ATTEMPTS)} concurrent races.`,
    );
  },

  async listReservationsForUser(tenantId: string, userId: string): Promise<Reservation[]> {
    const reservations = await ReservationModel.find({ tenantId, userId })
      .sort({ startTime: 1, _id: 1 })
      .lean<ReservationEntity[]>()
      .exec();
    return reservations.map(toReservation);
  },

  confirmReservation(tenantId: string, id: string): Promise<Reservation> {
    return transitionStatus(tenantId, id, 'CONFIRMED');
  },

  // Cancelling releases the slot at once: the overlap check only counts active statuses.
  cancelReservation(tenantId: string, id: string): Promise<Reservation> {
    return transitionStatus(tenantId, id, 'CANCELLED');
  },
} as const;

/**
 * Moves a reservation to `target`. The allowed source statuses are part of the
 * update filter, so the check and the write are one atomic operation: two
 * concurrent requests cannot both act on the same starting status.
 */
async function transitionStatus(
  tenantId: string,
  id: string,
  target: TargetStatus,
): Promise<Reservation> {
  const _id = new Types.ObjectId(id);
  const updated = await ReservationModel.findOneAndUpdate(
    { _id, tenantId, status: { $in: ALLOWED_TRANSITIONS[target] } },
    { $set: { status: target } },
    { returnDocument: 'after', runValidators: true },
  )
    .lean<ReservationEntity>()
    .exec();
  if (updated !== null) {
    return toReservation(updated);
  }

  // No match: either the reservation does not exist here, or its status forbids the move.
  const current = await ReservationModel.findOne({ _id, tenantId })
    .select({ status: 1 })
    .lean<Pick<ReservationEntity, 'status'>>()
    .exec();
  if (current === null) {
    throw new NotFoundError(`Reservation ${id} not found.`);
  }
  throw new ConflictError(
    `Reservation is ${current.status} and cannot become ${target}.`,
    'INVALID_STATUS_TRANSITION',
  );
}

/**
 * One optimistic booking attempt: read the resource's booking version, check for an
 * overlap, insert, then advance the version only if it is still the one read. The insert
 * comes before the version bump, so any booking that reads the bumped version already sees
 * this reservation in its overlap check; a booking that read the old version loses the
 * bump, removes its own insert, and retries. Exactly one of several concurrent bookings of
 * a slot therefore commits, without the transactions a standalone MongoDB cannot offer.
 * Returns undefined when this attempt lost the race and must be retried.
 */
async function tryBookSlot(
  tenantId: string,
  request: CreateReservationRequest,
  slot: SlotRequest,
): Promise<Reservation | undefined> {
  const { resourceId, startTime, endTime } = slot;

  // The lab defines only 201/400/409/500 for this operation, so a reference to
  // a resource that does not exist is an invalid field (400), not a 404.
  const resource = await ResourceModel.findOne({ _id: resourceId, tenantId })
    .select({ bookingVersion: 1 })
    .lean<Pick<ResourceEntity, 'bookingVersion'>>()
    .exec();
  if (resource === null) {
    throw new ValidationError(
      `resourceId ${request.resourceId} does not refer to an existing resource.`,
    );
  }
  // `null` also matches a resource stored before the counter existed.
  const version = resource.bookingVersion ?? null;

  // Half-open intervals: a slot may start exactly when another ends.
  const overlap = await ReservationModel.exists({
    tenantId,
    resourceId,
    status: { $in: ACTIVE_RESERVATION_STATUSES },
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
  const won = await ResourceModel.updateOne(
    { _id: resourceId, tenantId, bookingVersion: version },
    { $inc: { bookingVersion: 1 } },
  ).exec();
  if (won.modifiedCount === 1) {
    return toReservation(created.toObject<ReservationEntity>());
  }

  await ReservationModel.deleteOne({ _id: created._id, tenantId }).exec();
  return undefined;
}
