import { randomUUID } from 'node:crypto';

import { Document, model, Schema, type Model } from 'mongoose';

import {
  IDENTIFIER_PATTERN,
  RESERVATION_STATUSES,
  type ReservationStatus,
} from '../types/reservation';

/**
 * Persisted shape of a reservation. Its public fields map one-to-one to
 * `components/schemas/Reservation` in docs/openapi.yaml, with `_id` exposed as
 * `id` and the dates serialized as ISO 8601 strings. `tenantId` is the internal
 * partition key and is never serialized (AGENTS.md §1).
 */
export interface ReservationEntity {
  _id: string;
  tenantId: string;
  resourceId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
}

const reservationSchema = new Schema<ReservationEntity>(
  {
    _id: { type: String, default: (): string => randomUUID() },
    tenantId: { type: String, required: true, immutable: true },
    resourceId: { type: String, required: true, match: IDENTIFIER_PATTERN, ref: 'Resource' },
    userId: { type: String, required: true, match: IDENTIFIER_PATTERN, ref: 'User' },
    startTime: { type: Date, required: true },
    endTime: {
      type: Date,
      required: true,
      validate: {
        // `this` is the document on save but a Query in update validators, where
        // startTime is not known; required/cast failures are reported by those paths.
        validator(this: unknown, endTime: unknown): boolean {
          const startTime: unknown = this instanceof Document ? this.get('startTime') : undefined;
          if (!(startTime instanceof Date) || !(endTime instanceof Date)) {
            return true;
          }
          return endTime.getTime() > startTime.getTime();
        },
        message: 'endTime must be later than startTime.',
      },
    },
    status: { type: String, required: true, enum: RESERVATION_STATUSES, default: 'PENDING' },
  },
  // Reject unknown fields rather than drop them, like the contract's additionalProperties: false.
  { strict: 'throw', versionKey: false },
);

// Double-booking check: one tenant's active reservations of one resource, by time.
reservationSchema.index({ tenantId: 1, resourceId: 1, status: 1, startTime: 1 });
// GET /reservations/user/{userId}: one student's active reservations, by start time.
reservationSchema.index({ tenantId: 1, userId: 1, status: 1, startTime: 1 });

export const ReservationModel: Model<ReservationEntity> = model<ReservationEntity>(
  'Reservation',
  reservationSchema,
);
