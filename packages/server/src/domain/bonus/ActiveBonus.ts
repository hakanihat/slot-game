import type { BonusPick, BonusPrize, BonusState } from '@gem-rush/shared';
import type { BonusItem } from './bonusSequence.js';

/** Server-side Gem Vault state. `sequence` is secret and never leaves the server. */
export interface ActiveBonus {
  readonly roundId: string;
  readonly bet: number;
  readonly sequence: readonly BonusItem[];
  readonly picks: BonusPick[];
  totalWin: number;
}

export const prizeOf = (item: BonusItem, bet: number): BonusPrize =>
  item === 'collect'
    ? { kind: 'collect' }
    : { kind: 'prize', multiplier: item, amount: item * bet };

/** The client-safe projection: only what has already been revealed. */
export const toBonusState = (bonus: ActiveBonus): BonusState => ({
  bet: bonus.bet,
  tiles: bonus.sequence.length,
  picks: [...bonus.picks],
  totalWin: bonus.totalWin,
});
