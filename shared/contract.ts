/**
 * The schemas of the CampusHub Reservation API contract, `docs/openapi.yaml`,
 * declared once for both sides: the server re-exports them from
 * `src/types/reservation.ts`, the client from `client/src/types/campushub.ts`.
 * Change the contract first, then this file (AGENTS.md §3). It imports nothing,
 * so it compiles unchanged under the server's and the client's tsconfig.
 */

/** `components/schemas/ResourceType` */
export const RESOURCE_TYPES = ['ROOM', 'EQUIPMENT', 'LAB'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** `components/schemas/ReservationStatus` */
export const RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** `PENDING` and `CONFIRMED` reservations hold their slot; `CANCELLED` ones do not. */
export const ACTIVE_RESERVATION_STATUSES: readonly ReservationStatus[] = ['PENDING', 'CONFIRMED'];

/** The `pattern` of user identifiers, e.g. `user-456`. */
export const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** The `pattern` of MongoDB ObjectIds: resource and reservation ids. */
export const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export function isResourceType(value: unknown): value is ResourceType {
  return RESOURCE_TYPES.some((type) => type === value);
}

export function isReservationStatus(value: unknown): value is ReservationStatus {
  return RESERVATION_STATUSES.some((status) => status === value);
}

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

/** `components/schemas/ErrorResponse`: the body of every 4xx and 5xx response. */
export interface ErrorResponse {
  readonly code: string;
  readonly message: string;
}
