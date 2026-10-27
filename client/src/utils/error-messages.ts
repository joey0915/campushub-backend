import axios from 'axios';

import { ApiError, INVALID_RESPONSE_CODE, NETWORK_ERROR_CODE } from '../api/campushubApi';

/** Which workflow failed, so the same `code` can read naturally in each place. */
export type ApiAction = 'load-resources' | 'load-reservations' | 'create-reservation' | 'cancel';

export const DOUBLE_BOOKING_MESSAGE =
  'This resource is already reserved for the selected time window. Choose another time or resource.';

const FALLBACK_BY_ACTION: Readonly<Record<ApiAction, string>> = {
  'load-resources': 'Could not load campus resources.',
  'load-reservations': 'Could not load your reservations.',
  'create-reservation': 'Could not create the reservation.',
  cancel: 'Could not cancel the reservation.',
};

/** Aborted requests belong to an unmounted component or a superseded filter, not to the user. */
export function isAbortError(error: unknown): boolean {
  return axios.isCancel(error);
}

/**
 * Maps any failure from `campushubApi` to one sentence for an alert. Codes come
 * from `ErrorResponse.code` in `docs/openapi.yaml`, never from parsing messages.
 */
export function describeApiError(error: unknown, action: ApiAction): string {
  const fallback = FALLBACK_BY_ACTION[action];
  if (!(error instanceof ApiError)) {
    return `${fallback} An unexpected error occurred.`;
  }
  switch (error.code) {
    case 'DOUBLE_BOOKING':
      return DOUBLE_BOOKING_MESSAGE;
    case 'INVALID_STATUS_TRANSITION':
      return action === 'cancel'
        ? 'This reservation is already cancelled.'
        : `${fallback} ${error.message}`;
    case 'NOT_FOUND':
      return action === 'cancel'
        ? 'This reservation no longer exists.'
        : `${fallback} ${error.message}`;
    case 'VALIDATION_ERROR':
      return `${fallback} ${error.message}`;
    case NETWORK_ERROR_CODE:
      return `${fallback} The CampusHub API is unreachable — is the backend running?`;
    case INVALID_RESPONSE_CODE:
      return `${fallback} ${error.message}`;
    default:
      return `${fallback} The server reported an internal error; please try again.`;
  }
}
