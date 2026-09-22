import type { Server } from 'node:http';

import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';

/**
 * Process bootstrap: connect dependencies, start listening, and shut down
 * cleanly. The only file allowed to call `process.exit` (AGENTS.md §4).
 */
async function bootstrap(): Promise<void> {
  try {
    await connectDatabase();
    console.log('[startup] MongoDB connected.');
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    if (env.nodeEnv === 'production') {
      console.error(`[startup] MongoDB connection failed: ${reason}`);
      process.exit(1);
    }
    // In development the API still boots so routes that do not touch the
    // database (such as the health check) remain testable; /health reports
    // the dependency as degraded.
    console.warn(`[startup] MongoDB unavailable, continuing in ${env.nodeEnv}: ${reason}`);
  }

  const app = createApp();
  const server: Server = app.listen(env.port, () => {
    console.log(`[startup] CampusHub API listening on http://localhost:${String(env.port)}`);
    console.log(`[startup] Health check: GET /api/${env.apiVersion}/health`);
  });

  const shutdown = (signal: string): void => {
    console.log(`[shutdown] ${signal} received, closing server.`);
    server.close((closeError?: Error) => {
      if (closeError) {
        console.error('[shutdown] Error while closing server:', closeError.message);
      }
      disconnectDatabase()
        .then(() => {
          console.log('[shutdown] Complete.');
          process.exit(closeError ? 1 : 0);
        })
        .catch((dbError: unknown) => {
          console.error(
            '[shutdown] Error while disconnecting MongoDB:',
            dbError instanceof Error ? dbError.message : String(dbError),
          );
          process.exit(1);
        });
    });
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
}

bootstrap().catch((error: unknown) => {
  console.error('[startup] Fatal error:', error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
