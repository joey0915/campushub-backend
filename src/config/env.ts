import dotenv from 'dotenv';

dotenv.config();

/**
 * The single place in the codebase allowed to read `process.env`
 * (AGENTS.md §4). Everything else imports the typed `env` object, so a missing
 * or malformed variable fails at boot instead of at request time.
 */
export interface AppEnv {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly port: number;
  readonly apiVersion: string;
  readonly mongodbUri: string;
}

function readRequired(key: string): string {
  const value = process.env[key];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}. See .env.example.`);
  }
  return value.trim();
}

function readOptional(key: string, fallback: string): string {
  const value = process.env[key];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

function readPort(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(
      `Environment variable ${key} must be a port between 1 and 65535, got "${raw}".`,
    );
  }
  return parsed;
}

function readNodeEnv(): AppEnv['nodeEnv'] {
  const raw = readOptional('NODE_ENV', 'development');
  if (raw === 'development' || raw === 'test' || raw === 'production') {
    return raw;
  }
  throw new Error(`NODE_ENV must be "development", "test" or "production", got "${raw}".`);
}

export const env: AppEnv = {
  nodeEnv: readNodeEnv(),
  port: readPort('PORT', 3000),
  apiVersion: readOptional('API_VERSION', 'v1'),
  mongodbUri: readRequired('MONGODB_URI'),
};
