import { randomUUID } from 'node:crypto';
import {
  GAME_CONFIG,
  type CheatScenario,
  type FeatureSummary,
  type FreeSpinsState,
  type HistoryEntry,
  type SpinOutcome,
  type SpinResponse,
} from '@gem-rush/shared';
import { stopsForScenario } from '../domain/math/cheats.js';
import type { EngineResult, SlotEngine } from '../domain/math/SlotEngine.js';
import type { MathModel } from '../domain/math/types.js';
import { toBonusState } from '../domain/bonus/ActiveBonus.js';
import { drawBonusSequence } from '../domain/bonus/bonusSequence.js';
import type { Rng } from '../domain/rng/Rng.js';
import type { Session } from '../domain/session/Session.js';
import { AppError } from './errors.js';
import type { KeyedMutex } from './KeyedMutex.js';
import type { Clock, SessionRepository, Wallet } from './ports.js';

export const HISTORY_LIMIT = 50;

/**
 * Plays rounds. This is the only place where money moves, and the order is
 * deliberate: validate → debit → generate outcome → credit → persist.
 * If outcome generation fails after the debit, the stake is refunded.
 */
export class SpinService {
  constructor(
    private readonly engine: SlotEngine,
    private readonly repository: SessionRepository,
    private readonly wallet: Wallet,
    private readonly clock: Clock,
    private readonly model: MathModel,
    /** Shared with BonusService: one action per session at a time. */
    private readonly mutex: KeyedMutex,
    /** Draws the hidden Gem Vault prize order. */
    private readonly rng: Rng,
    private readonly cheatsEnabled = false,
  ) {}

  spin(session: Session, requestedBet: number, cheat?: CheatScenario): Promise<SpinResponse> {
    if (cheat && !this.cheatsEnabled) {
      return Promise.reject(new AppError('FORBIDDEN', 'Cheats are disabled on this server'));
    }
    return this.mutex.run(session.id, () => this.playRound(session, requestedBet, cheat));
  }

  history(session: Session): readonly HistoryEntry[] {
    return session.history;
  }

  private async playRound(
    session: Session,
    requestedBet: number,
    cheat?: CheatScenario,
  ): Promise<SpinResponse> {
    if (session.bonus) {
      throw new AppError('BONUS_IN_PROGRESS', 'Finish the Gem Vault bonus before spinning again');
    }
    const roundId = randomUUID();
    const inFeature = session.freeSpins !== null && session.freeSpins.remaining > 0;
    // During Free Spins the stake is locked to the triggering bet and not charged.
    const bet = inFeature ? (session.freeSpins as FreeSpinsState).bet : requestedBet;

    if (!inFeature) {
      assertValidBet(bet);
      await this.wallet.debit(session.id, bet, roundId);
    }

    let result: EngineResult;
    try {
      const mode = inFeature ? 'freeSpins' : 'base';
      result = cheat
        ? this.engine.spinAt(mode, bet, stopsForScenario(this.model, mode, cheat))
        : this.engine.spin(mode, bet);
    } catch (error) {
      if (!inFeature) await this.wallet.credit(session.id, bet, `refund:${roundId}`);
      throw error;
    }

    const balanceAfter =
      result.totalWin > 0
        ? await this.wallet.credit(session.id, result.totalWin, roundId)
        : await this.wallet.balance(session.id);

    const outcome: SpinOutcome = { roundId, ...result };
    const previousFeature = session.freeSpins;
    session.freeSpins = nextFreeSpinsState(previousFeature, result);
    const featureEnded: FeatureSummary | null =
      inFeature && previousFeature && session.freeSpins === null
        ? {
            spinsPlayed: previousFeature.total,
            totalWin: previousFeature.totalWin + result.totalWin,
          }
        : null;
    if (result.bonusTrigger) {
      session.bonus = {
        roundId,
        bet,
        sequence: drawBonusSequence(this.model.config.bonusGame, this.rng),
        picks: [],
        totalWin: 0,
      };
    }
    session.lastRound = outcome;
    session.history = [
      {
        roundId,
        timestamp: new Date(this.clock()).toISOString(),
        mode: result.mode,
        bet: result.mode === 'base' ? bet : 0,
        win: result.totalWin,
        balanceAfter,
      },
      ...session.history,
    ].slice(0, HISTORY_LIMIT);
    await this.repository.save(session);

    return {
      outcome,
      balance: balanceAfter,
      freeSpins: session.freeSpins,
      bonus: session.bonus ? toBonusState(session.bonus) : null,
      featureEnded,
    };
  }
}

function assertValidBet(bet: number): void {
  if (!(GAME_CONFIG.betLevels as readonly number[]).includes(bet)) {
    throw new AppError('INVALID_BET', `Bet must be one of: ${GAME_CONFIG.betLevels.join(', ')}`);
  }
}

/** Pure state transition for the Free Spins feature. */
export function nextFreeSpinsState(
  current: FreeSpinsState | null,
  result: EngineResult,
): FreeSpinsState | null {
  if (result.mode === 'freeSpins' && current) {
    const remaining = current.remaining - 1 + result.freeSpinsAwarded;
    if (remaining <= 0) return null;
    return {
      ...current,
      remaining,
      total: current.total + result.freeSpinsAwarded,
      totalWin: current.totalWin + result.totalWin,
    };
  }
  if (result.mode === 'base' && result.freeSpinsAwarded > 0) {
    return {
      remaining: result.freeSpinsAwarded,
      total: result.freeSpinsAwarded,
      bet: result.bet,
      totalWin: 0,
      multiplier: GAME_CONFIG.freeSpins.multiplier,
    };
  }
  return current;
}
