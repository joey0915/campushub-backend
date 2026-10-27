/**
 * Client-side mirror of the CampusHub Reservation API contract, `docs/openapi.yaml`.
 * Every declaration corresponds to one schema there; change the contract first,
 * then `src/types/reservation.ts` on the server, then this file.
 */

/** `components/schemas/ResourceType` */
export const RESOURCE_TYPES = ['ROOM', 'EQUIPMENT', 'LAB'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** `components/schemas/ReservationStatus` */
export const RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** `PENDING` and `CONFIRMED` reservations hold their slot; `CANCELLED` ones do not. */
export const ACTIVE_RESERVATION_STATUSES: readonly ReservationStatus[] = ['PENDING', 'CONFIRMED'];

/** The `pattern` of `Reservation.userId`, e.g. `user-456`. */
export const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** The `pattern` of MongoDB ObjectIds: resource and reservation ids. */
export const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

/** `components/schemas/Resource` */
export interface Resource {
  readonly id: string;
  readonly name: string;
  readonly type: ResourceType;
  readonly location: string;
  readonly isAvailable: boolean;
}

/** `components/schemas/Reservation`; times are ISO 8601 strings, normalized to UTC. */
export interface Reservation {
  readonly id: string;
  readonly resourceId: string;
  readonly userId: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly status: ReservationStatus;
}

/** Request body of `POST /reservations`: `Reservation` without its read-only `id` and `status`. */
export interface CreateReservationDTO {
  readonly resourceId: string;
  readonly userId: string;
  readonly startTime: string;
  readonly endTime: string;
}

/** Stable values of `ErrorResponse.code` listed in the contract. */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'DOUBLE_BOOKING',
  'INVALID_STATUS_TRANSITION',
  'INTERNAL_SERVER_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** `components/schemas/ErrorResponse`: the body of every 4xx and 5xx response. */
export interface ErrorResponse {
  readonly code: string;
  readonly message: string;
}
