import type { FastifyRequest } from 'fastify';

/** Extracts the token from an `Authorization: Bearer <token>` header. */
export function bearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length).trim() || undefined;
}
