import axios, { type AxiosInstance } from 'axios';

import { env } from '../config/env';
import {
  RESERVATION_STATUSES,
  RESOURCE_TYPES,
  type CreateReservationDTO,
  type ErrorResponse,
  type Reservation,
  type ReservationStatus,
  type Resource,
  type ResourceType,
} from '../types/campushub';

/**
 * Typed client for the operations in `docs/openapi.yaml`. Components never call
 * axios directly: they go through these functions (via hooks), which return
 * contract types on success and throw `ApiError` on every failure.
 */

/** Options every request accepts so a hook can abort it when its component unmounts. */
export interface RequestOptions {
  readonly signal?: AbortSignal;
}

/**
 * Any failed call. `status` is `null` when no HTTP response arrived (backend down,
 * network error); `code` is the contract's `ErrorResponse.code` when one did.
 */
export class ApiError extends Error {
  readonly status: number | null;
  readonly code: string;

  constructor(status: number | null, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';
export const INVALID_RESPONSE_CODE = 'INVALID_RESPONSE';

const GATEWAY_STATUSES: readonly number[] = [502, 503, 504];

const http: AxiosInstance = axios.create({
  baseURL: env.apiBasePath,
  headers: { Accept: 'application/json' },
  timeout: 10_000,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return isRecord(value) && typeof value.code === 'string' && typeof value.message === 'string';
}

function isResourceType(value: unknown): value is ResourceType {
  return RESOURCE_TYPES.some((type) => type === value);
}

function isReservationStatus(value: unknown): value is ReservationStatus {
  return RESERVATION_STATUSES.some((status) => status === value);
}

function isResource(value: unknown): value is Resource {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isResourceType(value.type) &&
    typeof value.location === 'string' &&
    typeof value.isAvailable === 'boolean'
  );
}

function isReservation(value: unknown): value is Reservation {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.resourceId === 'string' &&
    typeof value.userId === 'string' &&
    typeof value.startTime === 'string' &&
    typeof value.endTime === 'string' &&
    isReservationStatus(value.status)
  );
}

// Response bodies cross a trust boundary, so they are narrowed rather than cast.
function expectOne<T>(data: unknown, guard: (value: unknown) => value is T, what: string): T {
  if (!guard(data)) {
    throw new ApiError(null, INVALID_RESPONSE_CODE, `The API returned a malformed ${what}.`);
  }
  return data;
}

function expectList<T>(
  data: unknown,
  guard: (value: unknown) => value is T,
  what: string,
): readonly T[] {
  if (!Array.isArray(data) || !data.every(guard)) {
    throw new ApiError(null, INVALID_RESPONSE_CODE, `The API returned a malformed ${what} list.`);
  }
  return data;
}

/** Converts whatever axios or a guard threw into an `ApiError`; aborts are rethrown as-is. */
function toApiError(error: unknown): unknown {
  if (error instanceof ApiError || axios.isCancel(error)) {
    return error;
  }
  if (axios.isAxiosError(error)) {
    if (error.response === undefined) {
      return new ApiError(null, NETWORK_ERROR_CODE, 'Cannot reach the CampusHub API.');
    }
    const { status } = error.response;
    const body: unknown = error.response.data;
    if (isErrorResponse(body)) {
      return new ApiError(status, body.code, body.message);
    }
    // A gateway status without a contract body comes from the dev proxy, not the API:
    // the backend is down or still starting.
    if (GATEWAY_STATUSES.includes(status)) {
      return new ApiError(status, NETWORK_ERROR_CODE, 'Cannot reach the CampusHub API.');
    }
    return new ApiError(
      error.response.status,
      INVALID_RESPONSE_CODE,
      `The API answered ${String(status)} without an error body.`,
    );
  }
  return error;
}

async function request<T>(
  send: () => Promise<{ data: unknown }>,
  parse: (data: unknown) => T,
): Promise<T> {
  try {
    const response = await send();
    return parse(response.data);
  } catch (error: unknown) {
    throw toApiError(error);
  }
}

/** `GET /resources` — the campus catalogue, optionally filtered by `type`. */
export async function fetchResources(
  type?: ResourceType,
  options: RequestOptions = {},
): Promise<readonly Resource[]> {
  const params: { type?: ResourceType } = type === undefined ? {} : { type };
  return request(
    () => http.get<unknown>('/resources', { ...options, params }),
    (data) => expectList(data, isResource, 'resource'),
  );
}

/** `POST /reservations` — 201 with the new `PENDING` reservation, 409 `DOUBLE_BOOKING` on overlap. */
export async function createReservation(
  payload: CreateReservationDTO,
  options: RequestOptions = {},
): Promise<Reservation> {
  return request(
    () => http.post<unknown>('/reservations', payload, options),
    (data) => expectOne(data, isReservation, 'reservation'),
  );
}

/** `GET /reservations/user/{userId}` — every reservation of the student, ordered by `startTime`. */
export async function fetchUserReservations(
  userId: string,
  options: RequestOptions = {},
): Promise<readonly Reservation[]> {
  return request(
    () => http.get<unknown>(`/reservations/user/${encodeURIComponent(userId)}`, options),
    (data) => expectList(data, isReservation, 'reservation'),
  );
}

/** `PATCH /reservations/{id}/cancel` — 200 with the `CANCELLED` reservation; frees its slot. */
export async function cancelReservation(
  reservationId: string,
  options: RequestOptions = {},
): Promise<Reservation> {
  return request(
    () =>
      http.patch<unknown>(
        `/reservations/${encodeURIComponent(reservationId)}/cancel`,
        undefined,
        options,
      ),
    (data) => expectOne(data, isReservation, 'reservation'),
  );
}
