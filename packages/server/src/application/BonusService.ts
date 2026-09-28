import { randomUUID } from 'node:crypto';
import type { BonusPick, BonusPickResponse } from '@gem-rush/shared';
import { prizeOf, toBonusState } from '../domain/bonus/ActiveBonus.js';
import type { Session } from '../domain/session/Session.js';
import { AppError } from './errors.js';
import type { KeyedMutex } from './KeyedMutex.js';
import type { Clock, SessionRepository, Wallet } from './ports.js';
import { HISTORY_LIMIT } from './SpinService.js';

/**
 * Plays the Gem Vault pick bonus. Each pick reveals the next item of the
 * sequence drawn at trigger time, whichever tile was clicked. Prizes are
 * credited immediately, so nothing is lost if the player leaves mid-bonus.
 */
export class BonusService {
  constructor(
    private readonly repository: SessionRepository,
    private readonly wallet: Wallet,
    private readonly clock: Clock,
    private readonly mutex: KeyedMutex,
  ) {}

  pick(session: Session, tile: number): Promise<BonusPickResponse> {
    return this.mutex.run(session.id, () => this.reveal(session, tile));
  }

  private async reveal(session: Session, tile: number): Promise<BonusPickResponse> {
    const bonus = session.bonus;
    if (!bonus) throw new AppError('NO_BONUS', 'There is no bonus to play');
    if (!Number.isInteger(tile) || tile < 0 || tile >= bonus.sequence.length) {
      throw new AppError('INVALID_PICK', `Tile must be between 0 and ${bonus.sequence.length - 1}`);
    }
    if (bonus.picks.some((p) => p.tile === tile)) {
      throw new AppError('INVALID_PICK', 'That vault is already open');
    }

    const item = bonus.sequence[bonus.picks.length];
    if (item === undefined) throw new AppError('INVALID_PICK', 'No vaults left to open');
    const pick: BonusPick = { tile, prize: prizeOf(item, bonus.bet) };
    bonus.picks.push(pick);

    let balance: number;
    if (pick.prize.kind === 'prize') {
      bonus.totalWin += pick.prize.amount;
      balance = await this.wallet.credit(
        session.id,
        pick.prize.amount,
        `${bonus.roundId}:pick${bonus.picks.length}`,
      );
    } else {
      balance = await this.wallet.balance(session.id);
    }

    let finished: BonusPickResponse['finished'] = null;
    if (pick.prize.kind === 'collect') {
      finished = {
        totalWin: bonus.totalWin,
        unrevealed: this.unrevealed(bonus.sequence, bonus.picks, bonus.bet),
      };
      session.bonus = null;
      session.history = [
        {
          roundId: bonus.roundId || randomUUID(),
          timestamp: new Date(this.clock()).toISOString(),
          mode: 'bonus' as const,
          bet: 0,
          win: bonus.totalWin,
          balanceAfter: balance,
        },
        ...session.history,
      ].slice(0, HISTORY_LIMIT);
    }
    await this.repository.save(session);

    return { pick, balance, bonus: session.bonus ? toBonusState(session.bonus) : null, finished };
  }

  /** Shows the player what the closed vaults held — in sequence order, laid out over the remaining tiles. */
  private unrevealed(
    sequence: readonly (number | 'collect')[],
    picks: readonly BonusPick[],
    bet: number,
  ): BonusPick[] {
    const opened = new Set(picks.map((p) => p.tile));
    const closedTiles = sequence.map((_, tile) => tile).filter((tile) => !opened.has(tile));
    return sequence
      .slice(picks.length)
      .map((item, i) => ({ tile: closedTiles[i] ?? i, prize: prizeOf(item, bet) }));
  }
}
