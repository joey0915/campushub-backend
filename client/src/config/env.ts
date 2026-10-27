/**
 * The only module that reads `import.meta.env`, mirroring the server's
 * `src/config/env.ts`, so a missing variable fails at startup with a clear message.
 */
export interface ClientEnv {
  /** Path prefix of the API, e.g. `/api/v1`; the Vite dev server proxies it to the backend. */
  readonly apiBasePath: string;
}

function readRequired(key: string, value: string | undefined): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing ${key}. Copy client/.env.example to client/.env.`);
  }
  return value.trim();
}

export const env: ClientEnv = {
  apiBasePath: readRequired('VITE_API_BASE_PATH', import.meta.env.VITE_API_BASE_PATH),
};
