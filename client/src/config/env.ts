/**
 * The only module that reads `import.meta.env`, mirroring the server's
 * `src/config/env.ts`. Like the server's optional variables, each has a default
 * so the client runs from a fresh clone without a `.env`.
 */
export interface ClientEnv {
  /** Path prefix of the API, e.g. `/api/v1`; the Vite dev server proxies it to the backend. */
  readonly apiBasePath: string;
}

function readOptional(value: string | undefined, fallback: string): string {
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

export const env: ClientEnv = {
  // `servers[0].url` in docs/openapi.yaml, relative so requests go through the dev proxy.
  apiBasePath: readOptional(import.meta.env.VITE_API_BASE_PATH, '/api/v1'),
};
