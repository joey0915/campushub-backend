import {
  isReservationStatus,
  isResourceType,
  type ErrorResponse,
  type Reservation,
  type Resource,
} from '../types/reservation';
import { isRecord } from '../utils/validation';

// Supertest types `body` as `any`; tests narrow it with these guards instead of casting.

export function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    typeof value['code'] === 'string' &&
    typeof value['message'] === 'string'
  );
}

export function isReservation(value: unknown): value is Reservation {
  return (
    isRecord(value) &&
    Object.keys(value).length === 6 &&
    typeof value['id'] === 'string' &&
    typeof value['resourceId'] === 'string' &&
    typeof value['userId'] === 'string' &&
    typeof value['startTime'] === 'string' &&
    typeof value['endTime'] === 'string' &&
    isReservationStatus(value['status'])
  );
}

export function isResource(value: unknown): value is Resource {
  return (
    isRecord(value) &&
    Object.keys(value).length === 5 &&
    typeof value['id'] === 'string' &&
    typeof value['name'] === 'string' &&
    isResourceType(value['type']) &&
    typeof value['location'] === 'string' &&
    typeof value['isAvailable'] === 'boolean'
  );
}

/** Narrows a body to `T` or fails the test with the body that did not match. */
export function expectBody<T>(body: unknown, guard: (value: unknown) => value is T): T {
  if (!guard(body)) {
    throw new Error(`Response body does not match ${guard.name}: ${JSON.stringify(body)}`);
  }
  return body;
}

export function expectList<T>(body: unknown, guard: (value: unknown) => value is T): T[] {
  if (!Array.isArray(body) || !body.every(guard)) {
    throw new Error(`Response body is not a list matching ${guard.name}: ${JSON.stringify(body)}`);
  }
  return body;
}
