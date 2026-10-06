import type { ErrorResponseBody } from './error.types';

/**
 * TypeScript mirror of the CampusHub Reservation API contract, `docs/openapi.yaml`.
 * Every declaration corresponds to one schema or operation there; change the
 * contract first, then this file (AGENTS.md §3).
 */

/** `components/schemas/ResourceType` */
export const RESOURCE_TYPES = ['ROOM', 'EQUIPMENT', 'LAB'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** `components/schemas/ReservationStatus` */
export const RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** The `pattern` of user identifiers, e.g. `user-456`. */
export const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

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

/**
 * `components/schemas/Reservation`. `startTime` and `endTime` are ISO 8601
 * date-time strings, normalized to UTC in responses.
 */
export interface Reservation {
  readonly id: string;
  readonly resourceId: string;
  readonly userId: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly status: ReservationStatus;
}

/**
 * Request body of `POST /reservations`: the `Reservation` schema without its
 * read-only `id` and `status`.
 */
export interface CreateReservationRequest {
  readonly resourceId: string;
  readonly userId: string;
  readonly startTime: string;
  readonly endTime: string;
}

/** `components/schemas/User`, referenced by `Reservation.userId`. No operation returns it yet. */
export interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

/** `components/schemas/ErrorResponse`, produced only by the central error middleware. */
export type ErrorResponse = ErrorResponseBody;

/** Validated query of `GET /resources`, passed to the service as its filter. */
export interface ResourceFilter {
  readonly type?: string;
}

/** Path parameters of `GET /reservations/user/{userId}`. */
export interface ListUserReservationsParams {
  readonly userId: string;
}

/** Response bodies of `GET /resources`, keyed by declared status code. */
export interface ListResourcesResponses {
  readonly 200: readonly Resource[];
  readonly 400: ErrorResponse;
  readonly 500: ErrorResponse;
}

/** Response bodies of `POST /reservations`, keyed by declared status code. */
export interface CreateReservationResponses {
  readonly 201: Reservation;
  readonly 400: ErrorResponse;
  readonly 409: ErrorResponse;
  readonly 500: ErrorResponse;
}

/** Response bodies of `GET /reservations/user/{userId}`, keyed by declared status code. */
export interface ListUserReservationsResponses {
  readonly 200: readonly Reservation[];
  readonly 400: ErrorResponse;
  readonly 500: ErrorResponse;
}
