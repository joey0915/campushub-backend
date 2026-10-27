import { USER_ID_PATTERN, type CreateReservationDTO, type Resource } from '../types/campushub';
import { parseLocalInputValue } from './datetime';

/** Raw values of the booking form, exactly as the inputs hold them. */
export interface BookingFormValues {
  readonly startTime: string;
  readonly endTime: string;
}

export interface BookingFieldErrors {
  readonly resource?: string;
  readonly userId?: string;
  readonly startTime?: string;
  readonly endTime?: string;
}

export type BookingValidationResult =
  | { readonly ok: true; readonly payload: CreateReservationDTO }
  | { readonly ok: false; readonly errors: BookingFieldErrors };

/**
 * Checks what the contract would reject with a 400, plus a booking in the past,
 * before any request is sent. Overlaps can only be judged by the server (409).
 */
export function validateBooking(
  resource: Resource | null,
  userId: string,
  values: BookingFormValues,
  now: Date,
): BookingValidationResult {
  const start = parseLocalInputValue(values.startTime);
  const end = parseLocalInputValue(values.endTime);

  const errors: {
    resource?: string;
    userId?: string;
    startTime?: string;
    endTime?: string;
  } = {};

  if (resource === null) {
    errors.resource = 'Select a resource from the directory first.';
  } else if (!resource.isAvailable) {
    errors.resource = `${resource.name} is not available for booking.`;
  }
  if (!USER_ID_PATTERN.test(userId)) {
    errors.userId = 'Student ID must be 1–64 letters, digits, hyphens or underscores.';
  }
  if (start === null) {
    errors.startTime = 'Choose a start time.';
  } else if (start.getTime() <= now.getTime()) {
    errors.startTime = 'Start time must be in the future.';
  }
  if (end === null) {
    errors.endTime = 'Choose an end time.';
  } else if (start !== null && end.getTime() <= start.getTime()) {
    errors.endTime = 'End time must be later than the start time.';
  }

  if (resource === null || start === null || end === null || Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    payload: {
      resourceId: resource.id,
      userId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
  };
}
