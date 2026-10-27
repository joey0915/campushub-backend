import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type UserConfig } from 'vite';

// The dev server proxies `/api` to the backend so the browser talks to one origin and
// the API needs no CORS middleware. The backend origin comes from `.env`, not source.
export default defineConfig(({ mode }): UserConfig => {
  const env = loadEnv(mode, process.cwd(), 'CAMPUSHUB_');
  const apiOrigin = env.CAMPUSHUB_API_ORIGIN;
  if (apiOrigin === undefined || apiOrigin.trim() === '') {
    throw new Error('Missing CAMPUSHUB_API_ORIGIN. Copy client/.env.example to client/.env.');
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target: apiOrigin, changeOrigin: true },
      },
    },
  };
});
