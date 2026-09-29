/**
 * Shape of every error response the API returns: `components/schemas/ErrorResponse`
 * in docs/openapi.yaml, exactly the error code and message the lab defines.
 */
export interface ErrorResponseBody {
  readonly code: string;
  readonly message: string;
}
