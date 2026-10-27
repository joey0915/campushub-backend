import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type UserConfig } from 'vite';

// Matches the server's `PORT` default, so a fresh clone runs without a `.env`.
const DEFAULT_API_ORIGIN = 'http://localhost:3000';

// The dev server proxies `/api` to the backend so the browser talks to one origin and
// the API needs no CORS middleware. Override the origin in `.env`.
export default defineConfig(({ mode }): UserConfig => {
  const env = loadEnv(mode, process.cwd(), 'CAMPUSHUB_');
  const configured = env.CAMPUSHUB_API_ORIGIN?.trim() ?? '';
  const apiOrigin = configured === '' ? DEFAULT_API_ORIGIN : configured;

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target: apiOrigin, changeOrigin: true },
      },
    },
  };
});
