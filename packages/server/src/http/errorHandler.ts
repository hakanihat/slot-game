import type { ApiErrorBody } from '@gem-rush/shared';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../application/errors.js';

/** Maps every failure onto the uniform `ApiErrorBody` shape; never leaks internals. */
export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof AppError) {
    const body: ApiErrorBody = { error: { code: error.code, message: error.message } };
    return reply.status(error.statusCode).send(body);
  }

  const statusCode = 'statusCode' in error ? error.statusCode : undefined;
  if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
    const body: ApiErrorBody = { error: { code: 'BAD_REQUEST', message: error.message } };
    return reply.status(statusCode).send(body);
  }

  request.log.error({ err: error }, 'Unhandled error');
  const body: ApiErrorBody = { error: { code: 'INTERNAL', message: 'Something went wrong' } };
  return reply.status(500).send(body);
}
