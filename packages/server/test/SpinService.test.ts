import { describe, expect, it } from 'vitest';
import { KeyedMutex } from '../src/application/KeyedMutex.js';
import { createContainer } from '../src/container.js';
import { ScriptedRng } from '../src/domain/rng/ScriptedRng.js';
import { SeededRng } from '../src/domain/rng/SeededRng.js';
import type { Rng } from '../src/domain/rng/Rng.js';
import { stopsShowing } from './helpers.js';

const setup = (rng: Rng = new SeededRng(1), startingBalance = 10_000) => {
  let now = 1_000_000;
  const container = createContainer({
    startingBalance,
    idleTimeoutMs: 60_000,
    rng,
    clock: () => now,
  });
  return { ...container, advance: (ms: number) => (now += ms) };
};

describe('SpinService', () => {
  it('debits the bet and credits the win', async () => {
    const { sessions, spins } = setup();
    const { session } = await sessions.create();
    const { outcome, balance } = await spins.spin(session, 100);
    expect(balance).toBe(10_000 - 100 + outcome.totalWin);
  });

  it('rejects bets that are not an allowed level', async () => {
    const { sessions, spins } = setup();
    const { session } = await sessions.create();
    await expect(spins.spin(session, 15)).rejects.toMatchObject({ code: 'INVALID_BET' });
  });

  it('rejects spins the player cannot afford', async () => {
    const { sessions, spins } = setup(new SeededRng(1), 50);
    const { session } = await sessions.create();
    await expect(spins.spin(session, 100)).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
  });

  it('plays a full free spins feature without charging the player', async () => {
    const trigger = stopsShowing(['SCATTER', null, 'SCATTER', null, 'SCATTER']);
    const blank = stopsShowing([null, null, null, null, null], 'freeSpins');
    const { sessions, spins } = setup(
      new ScriptedRng([...trigger, ...Array(10).fill(blank).flat()]),
    );
    const { session } = await sessions.create();

    const triggering = await spins.spin(session, 100);
    expect(triggering.freeSpins).toMatchObject({
      remaining: 10,
      total: 10,
      bet: 100,
      multiplier: 3,
    });

    let response = triggering;
    let featureWins = 0;
    for (let i = 0; i < 10; i += 1) {
      // The requested bet is ignored during the feature — the triggering bet is locked in.
      response = await spins.spin(session, 2000);
      expect(response.outcome.mode).toBe('freeSpins');
      expect(response.outcome.bet).toBe(100);
      featureWins += response.outcome.totalWin;
    }

    expect(response.freeSpins).toBeNull();
    expect(response.featureEnded).toEqual({ spinsPlayed: 10, totalWin: featureWins });
    expect(response.balance).toBe(10_000 - 100 + triggering.outcome.totalWin + featureWins);
    expect(session.history.filter((h) => h.mode === 'freeSpins').every((h) => h.bet === 0)).toBe(
      true,
    );
  });

  it('serialises concurrent rounds for the same session', async () => {
    const { sessions, spins, wallet } = setup();
    const { session } = await sessions.create();
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => spins.spin(session, 100)));
    const totalWin = results.reduce((sum, r) => sum + r.outcome.totalWin, 0);
    expect(await wallet.balance(session.id)).toBe(10_000 - 500 + totalWin);
    expect(session.history).toHaveLength(5);
  });
});

describe('SessionService', () => {
  it('expires idle sessions', async () => {
    const { sessions, advance } = setup();
    const { token } = await sessions.create();
    await expect(sessions.authenticate(token)).resolves.toBeDefined();
    advance(61_000);
    await expect(sessions.authenticate(token)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(await sessions.sweepIdle()).toBe(1);
  });

  it('only refills an empty balance', async () => {
    const { sessions, wallet } = setup(new SeededRng(1), 1_000);
    const { session } = await sessions.create();
    await expect(sessions.refill(session)).rejects.toMatchObject({ code: 'REFILL_NOT_ALLOWED' });
    await wallet.debit(session.id, 990, 'test');
    await expect(sessions.refill(session)).resolves.toMatchObject({ balance: 1_000 });
  });
});

describe('KeyedMutex', () => {
  it('runs tasks for the same key one after another, even after a failure', async () => {
    const mutex = new KeyedMutex();
    const order: string[] = [];
    const task =
      (name: string, fail = false) =>
      async () => {
        order.push(`start ${name}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push(`end ${name}`);
        if (fail) throw new Error(name);
      };
    await Promise.allSettled([mutex.run('k', task('a', true)), mutex.run('k', task('b'))]);
    expect(order).toEqual(['start a', 'end a', 'start b', 'end b']);
  });
});
