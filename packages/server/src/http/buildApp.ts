import { existsSync } from 'node:fs';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Container } from '../container.js';
import { errorHandler } from './errorHandler.js';
import { gameRoutes } from './routes/gameRoutes.js';

export interface AppOptions {
  readonly logLevel?: string;
  readonly corsOrigins?: readonly string[];
  /** When set and present on disk, the built client is served from `/`. */
  readonly clientDist?: string;
}

export async function buildApp(
  container: Container,
  options: AppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logLevel && options.logLevel !== 'silent' ? { level: options.logLevel } : false,
    bodyLimit: 4 * 1024,
  });

  app.setErrorHandler(errorHandler);

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    return payload;
  });

  if (options.corsOrigins?.length) {
    await app.register(cors, { origin: [...options.corsOrigins] });
  }

  await gameRoutes(app, container);

  if (options.clientDist && existsSync(options.clientDist)) {
    await app.register(fastifyStatic, { root: options.clientDist, wildcard: false });
    app.setNotFoundHandler((request, reply) =>
      request.url.startsWith('/api/')
        ? reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
        : reply.sendFile('index.html'),
    );
  }

  return app;
}
