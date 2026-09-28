import { loadEnv } from './config/env.js';
import { createContainer } from './container.js';
import { buildApp } from './http/buildApp.js';

const SWEEP_INTERVAL_MS = 60_000;

async function main() {
  const env = loadEnv();
  const container = createContainer({
    startingBalance: env.STARTING_BALANCE,
    idleTimeoutMs: env.SESSION_IDLE_MINUTES * 60_000,
  });
  const app = await buildApp(container, {
    logLevel: env.LOG_LEVEL,
    corsOrigins: env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()),
    clientDist: env.CLIENT_DIST,
  });

  const sweeper = setInterval(() => {
    container.sessions
      .sweepIdle()
      .then((count) => count > 0 && app.log.info({ count }, 'Expired idle sessions'))
      .catch((err: unknown) => app.log.error({ err }, 'Session sweep failed'));
  }, SWEEP_INTERVAL_MS);
  sweeper.unref();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down');
    clearInterval(sweeper);
    await app.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
