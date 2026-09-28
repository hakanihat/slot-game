import {
  BONUS_GAME,
  BONUS_TILES,
  expectedBonusMultiplier,
  type BonusPickResponse,
  type CreateSessionResponse,
  type SpinResponse,
} from '@gem-rush/shared';
import { describe, expect, it } from 'vitest';
import { bonusMultiplierOf, drawBonusSequence } from '../src/domain/bonus/bonusSequence.js';
import { evaluateBonusTrigger } from '../src/domain/math/evaluator.js';
import { createContainer } from '../src/container.js';
import { SeededRng } from '../src/domain/rng/SeededRng.js';
import { buildApp } from '../src/http/buildApp.js';

describe('Gem Vault prize order', () => {
  it('always starts with a prize and contains every tile exactly once', () => {
    const rng = new SeededRng(11);
    for (let i = 0; i < 500; i += 1) {
      const sequence = drawBonusSequence(BONUS_GAME, rng);
      expect(sequence).toHaveLength(BONUS_TILES);
      expect(sequence[0]).not.toBe('collect');
      expect(sequence.filter((x) => x === 'collect')).toHaveLength(BONUS_GAME.collects);
      expect(sequence.filter((x) => x !== 'collect').sort((a, b) => Number(a) - Number(b))).toEqual(
        [...BONUS_GAME.prizes].sort((a, b) => a - b),
      );
    }
  });

  it('matches the closed-form expected value', () => {
    const rng = new SeededRng(5);
    const rounds = 200_000;
    let total = 0;
    for (let i = 0; i < rounds; i += 1)
      total += bonusMultiplierOf(drawBonusSequence(BONUS_GAME, rng));
    expect(total / rounds).toBeCloseTo(expectedBonusMultiplier(), 0);
  });
});

describe('evaluateBonusTrigger', () => {
  const grid = (reels: string[][]) => reels as never;

  it('triggers with a BONUS on each of reels 1, 3 and 5', () => {
    const result = evaluateBonusTrigger(
      grid([
        ['J', 'BONUS', 'Q'],
        ['K', 'A', 'Q'],
        ['BONUS', 'J', 'Q'],
        ['K', 'A', 'Q'],
        ['J', 'Q', 'BONUS'],
      ]),
      BONUS_GAME.triggerReels,
    );
    expect(result?.positions).toEqual([
      { reel: 0, row: 1 },
      { reel: 2, row: 0 },
      { reel: 4, row: 2 },
    ]);
  });

  it('does not trigger when a trigger reel is missing the symbol', () => {
    const result = evaluateBonusTrigger(
      grid([
        ['J', 'BONUS', 'Q'],
        ['K', 'A', 'Q'],
        ['A', 'J', 'Q'],
        ['K', 'A', 'Q'],
        ['J', 'Q', 'BONUS'],
      ]),
      BONUS_GAME.triggerReels,
    );
    expect(result).toBeNull();
  });
});

describe('Gem Vault bonus flow', () => {
  const start = async () => {
    const container = createContainer({
      startingBalance: 100_000,
      idleTimeoutMs: 60_000,
      rng: new SeededRng(9),
      cheatsEnabled: true,
    });
    const { session } = await container.sessions.create();
    const triggered = await container.spins.spin(session, 100, 'bonus');
    return { ...container, session, triggered };
  };

  it('triggers from a spin and blocks spinning until finished', async () => {
    const { spins, session, triggered } = await start();
    expect(triggered.outcome.bonusTrigger?.positions).toHaveLength(3);
    expect(triggered.bonus).toMatchObject({ bet: 100, tiles: BONUS_TILES, picks: [], totalWin: 0 });
    await expect(spins.spin(session, 100)).rejects.toMatchObject({ code: 'BONUS_IN_PROGRESS' });
  });

  it('credits each prize, ends on COLLECT and reveals the rest', async () => {
    const { bonus, sessions, wallet, session, triggered } = await start();
    const balanceBefore = triggered.balance;
    let response: BonusPickResponse | null = null;
    let opened = 0;
    let prizeSum = 0;
    for (let tile = 0; tile < BONUS_TILES && !response?.finished; tile += 1) {
      response = await bonus.pick(session, tile);
      opened += 1;
      if (response.pick.prize.kind === 'prize') prizeSum += response.pick.prize.amount;
    }
    const finished = response?.finished;
    expect(finished).not.toBeNull();
    expect(response?.pick.prize.kind).toBe('collect');
    expect(finished?.totalWin).toBe(prizeSum);
    expect(finished?.totalWin).toBeGreaterThan(0);
    expect(await wallet.balance(session.id)).toBe(balanceBefore + prizeSum);
    // Opened vaults + revealed leftovers cover every tile exactly once.
    const tiles = [...Array(opened).keys(), ...(finished?.unrevealed.map((p) => p.tile) ?? [])];
    expect(new Set(tiles).size).toBe(BONUS_TILES);
    expect((await sessions.state(session)).bonus).toBeNull();
    expect(session.history[0]).toMatchObject({ mode: 'bonus', bet: 0, win: finished?.totalWin });
  });

  it('rejects opening the same vault twice, invalid tiles, and picks without a bonus', async () => {
    const { bonus, session } = await start();
    await bonus.pick(session, 3);
    await expect(bonus.pick(session, 3)).rejects.toMatchObject({ code: 'INVALID_PICK' });
    await expect(bonus.pick(session, 99)).rejects.toMatchObject({ code: 'INVALID_PICK' });

    const fresh = await createContainer({
      startingBalance: 1000,
      idleTimeoutMs: 60_000,
    }).sessions.create();
    const other = createContainer({ startingBalance: 1000, idleTimeoutMs: 60_000 });
    await expect(other.bonus.pick(fresh.session, 0)).rejects.toMatchObject({ code: 'NO_BONUS' });
  });

  it('never exposes the hidden prize order over HTTP', async () => {
    const container = createContainer({
      startingBalance: 100_000,
      idleTimeoutMs: 60_000,
      cheatsEnabled: true,
    });
    const app = await buildApp(container);
    const { token } = (
      await app.inject({ method: 'POST', url: '/api/sessions' })
    ).json<CreateSessionResponse>();
    const auth = { authorization: `Bearer ${token}` };
    const spin = await app.inject({
      method: 'POST',
      url: '/api/spin',
      headers: auth,
      payload: { bet: 100, cheat: 'bonus' },
    });
    expect(spin.json<SpinResponse>().bonus?.picks).toEqual([]);
    expect(spin.body).not.toMatch(/sequence|collect/);

    const me = await app.inject({ method: 'GET', url: '/api/sessions/me', headers: auth });
    expect(me.body).not.toMatch(/sequence/);

    const pick = await app.inject({
      method: 'POST',
      url: '/api/bonus/pick',
      headers: auth,
      payload: { tile: 0 },
    });
    expect(pick.statusCode).toBe(200);
    expect(pick.json<BonusPickResponse>().pick.prize.kind).toBe('prize');
    await app.close();
  });
});
