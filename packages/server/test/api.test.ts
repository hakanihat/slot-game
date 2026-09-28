import type { CreateSessionResponse, SpinResponse } from '@gem-rush/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContainer } from '../src/container.js';
import { SeededRng } from '../src/domain/rng/SeededRng.js';
import { buildApp } from '../src/http/buildApp.js';

describe('HTTP API', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const container = createContainer({
      startingBalance: 100_000,
      idleTimeoutMs: 60_000,
      rng: new SeededRng(3),
    });
    app = await buildApp(container);
  });
  afterEach(() => app.close());

  const createSession = async () => {
    const response = await app.inject({ method: 'POST', url: '/api/sessions' });
    expect(response.statusCode).toBe(201);
    return response.json<CreateSessionResponse>();
  };

  it('exposes the public game config without reel strips', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/game' });
    expect(response.statusCode).toBe(200);
    const body = response.json<Record<string, unknown>>();
    expect(body).toMatchObject({ reels: 5, rows: 3 });
    expect(JSON.stringify(body)).not.toMatch(/reelSets|strips/);
  });

  it('creates a session and plays a spin', async () => {
    const { token, state } = await createSession();
    expect(state.balance).toBe(100_000);

    const response = await app.inject({
      method: 'POST',
      url: '/api/spin',
      headers: { authorization: `Bearer ${token}` },
      payload: { bet: 100 },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<SpinResponse>();
    expect(body.outcome.grid).toHaveLength(5);
    expect(body.balance).toBe(100_000 - 100 + body.outcome.totalWin);

    const history = await app.inject({
      method: 'GET',
      url: '/api/history',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(history.json<{ rounds: unknown[] }>().rounds).toHaveLength(1);
  });

  it('restores the session state for a returning player', async () => {
    const { token } = await createSession();
    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.json()).toMatchObject({ balance: 100_000, freeSpins: null });
  });

  it('rejects unauthenticated requests', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/spin', payload: { bet: 100 } });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Missing session token' },
    });
  });

  it('validates the request body', async () => {
    const { token } = await createSession();
    const response = await app.inject({
      method: 'POST',
      url: '/api/spin',
      headers: { authorization: `Bearer ${token}` },
      payload: { bet: 'lots' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'BAD_REQUEST' } });
  });
});
