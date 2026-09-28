import { SessionService } from './application/SessionService.js';
import { SpinService } from './application/SpinService.js';
import type { Clock } from './application/ports.js';
import { GEM_RUSH_MODEL } from './domain/math/reelSets.js';
import { SlotEngine } from './domain/math/SlotEngine.js';
import { CryptoRng } from './domain/rng/CryptoRng.js';
import type { Rng } from './domain/rng/Rng.js';
import { InMemorySessionRepository } from './infrastructure/InMemorySessionRepository.js';
import { InMemoryWallet } from './infrastructure/InMemoryWallet.js';

export interface ContainerOptions {
  readonly startingBalance: number;
  readonly idleTimeoutMs: number;
  /** Overridable for deterministic tests. */
  readonly rng?: Rng;
  readonly clock?: Clock;
}

export interface Container {
  readonly sessions: SessionService;
  readonly spins: SpinService;
  readonly wallet: InMemoryWallet;
}

/**
 * Composition root — the single place where concrete implementations are
 * chosen. Replacing the in-memory adapters with Redis or a remote wallet
 * touches only this file.
 */
export function createContainer(options: ContainerOptions): Container {
  const clock = options.clock ?? Date.now;
  const repository = new InMemorySessionRepository();
  const wallet = new InMemoryWallet();
  const engine = new SlotEngine(GEM_RUSH_MODEL, options.rng ?? new CryptoRng());

  const sessions = new SessionService(repository, wallet, clock, {
    startingBalance: options.startingBalance,
    idleTimeoutMs: options.idleTimeoutMs,
  });
  const spins = new SpinService(engine, repository, wallet, clock);

  return { sessions, spins, wallet };
}
