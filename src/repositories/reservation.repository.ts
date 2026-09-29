import { randomUUID } from 'node:crypto';

import type { ReservationEntity } from '../models/reservation.model';
import type { ReservationStatus } from '../types/reservation';

/** A reservation before the store assigns its `_id`. */
export type NewReservationEntity = Omit<ReservationEntity, '_id'>;

/**
 * In-memory stand-in for the `reservations` collection: Lab 2 requires the API
 * to run without a database. It starts empty and lives as long as the process.
 * Records have exactly the `ReservationEntity` shape, so moving to
 * `ReservationModel` changes only this file (AGENTS.md §3).
 */
const reservations: ReservationEntity[] = [];

export const reservationRepository = {
  /** A tenant's reservations for one user with one of `statuses`, earliest first. */
  findByUser(
    tenantId: string,
    userId: string,
    statuses: readonly ReservationStatus[],
  ): Promise<ReservationEntity[]> {
    return Promise.resolve(
      reservations
        .filter(
          (reservation) =>
            reservation.tenantId === tenantId &&
            reservation.userId === userId &&
            statuses.includes(reservation.status),
        )
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
    );
  },

  /**
   * Inserts `candidate` unless a reservation of the same tenant and resource,
   * in one of `blockingStatuses`, overlaps it; resolves to `undefined` then.
   * Intervals are half-open, so a slot may start exactly when another ends.
   *
   * The overlap check and the insert run in one synchronous step, so two
   * concurrent requests can never both claim a slot. A MongoDB implementation
   * must keep that guarantee, e.g. by serializing writes per resource.
   */
  insertIfNoOverlap(
    candidate: NewReservationEntity,
    blockingStatuses: readonly ReservationStatus[],
  ): Promise<ReservationEntity | undefined> {
    const start = candidate.startTime.getTime();
    const end = candidate.endTime.getTime();
    const overlaps = reservations.some(
      (existing) =>
        existing.tenantId === candidate.tenantId &&
        existing.resourceId === candidate.resourceId &&
        blockingStatuses.includes(existing.status) &&
        existing.startTime.getTime() < end &&
        start < existing.endTime.getTime(),
    );
    if (overlaps) {
      return Promise.resolve(undefined);
    }

    const created: ReservationEntity = { _id: randomUUID(), ...candidate };
    reservations.push(created);
    return Promise.resolve(created);
  },
} as const;
