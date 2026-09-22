/** Shape of every error response the API returns. */
export interface ErrorResponseBody {
  readonly status: 'error';
  readonly message: string;
  readonly code: string;
  readonly path: string;
  readonly timestamp: string;
}
