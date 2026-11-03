import type { ErrorResponse, Reservation, Resource } from '../../shared/contract';

/**
 * The server's view of the CampusHub Reservation API contract, `docs/openapi.yaml`:
 * its schemas come from `shared/contract.ts`, which the client imports too, and
 * this file adds the per-operation types only the server needs (AGENTS.md §3).
 */
export * from '../../shared/contract';

/** Validated query of `GET /resources`, passed to the service as its filter. */
export interface ResourceFilter {
  readonly type?: string;
  readonly isAvailable?: boolean;
}

/** Path parameters of `GET /reservations/user/{userId}`. */
export interface ListUserReservationsParams {
  readonly userId: string;
}

/** `components/parameters/ReservationId`: the path of the status-transition operations. */
export interface ReservationIdParams {
  readonly id: string;
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

/**
 * Response bodies of `PATCH /reservations/{id}/confirm` and
 * `PATCH /reservations/{id}/cancel`, keyed by declared status code.
 */
export interface ReservationTransitionResponses {
  readonly 200: Reservation;
  readonly 400: ErrorResponse;
  readonly 404: ErrorResponse;
  readonly 409: ErrorResponse;
  readonly 500: ErrorResponse;
}
