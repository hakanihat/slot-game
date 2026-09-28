import { GAME_CONFIG } from '@gem-rush/shared';
import type {
  CreateSessionResponse,
  HistoryResponse,
  SessionState,
  SpinResponse,
} from '@gem-rush/shared';
import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container.js';
import { bearerToken } from '../auth.js';
import { parse, SpinRequestSchema } from '../schemas.js';

/**
 * REST API. Handlers stay thin: authenticate, validate, delegate to an
 * application service, return its DTO.
 */
export async function gameRoutes(app: FastifyInstance, { sessions, spins }: Container) {
  app.get('/api/health', async () => ({ status: 'ok' }));

  app.get('/api/game', async () => GAME_CONFIG);

  app.post('/api/sessions', async (_request, reply): Promise<CreateSessionResponse> => {
    const { token, session } = await sessions.create();
    reply.status(201);
    return { token, state: await sessions.state(session) };
  });

  app.get('/api/sessions/me', async (request): Promise<SessionState> => {
    const session = await sessions.authenticate(bearerToken(request));
    return sessions.state(session);
  });

  app.post('/api/sessions/me/refill', async (request): Promise<SessionState> => {
    const session = await sessions.authenticate(bearerToken(request));
    return sessions.refill(session);
  });

  app.post('/api/spin', async (request): Promise<SpinResponse> => {
    const session = await sessions.authenticate(bearerToken(request));
    const { bet } = parse(SpinRequestSchema, request.body);
    return spins.spin(session, bet);
  });

  app.get('/api/history', async (request): Promise<HistoryResponse> => {
    const session = await sessions.authenticate(bearerToken(request));
    return { rounds: spins.history(session) };
  });
}
