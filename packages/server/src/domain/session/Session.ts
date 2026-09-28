import type { ActiveBonus } from '../bonus/ActiveBonus.js';
import type { FreeSpinsState, HistoryEntry, SpinOutcome } from '@gem-rush/shared';

/**
 * A player's game session. Money is intentionally *not* stored here: balances
 * live behind the Wallet port, mirroring real deployments where the operator
 * owns the wallet and the game server only requests debits and credits.
 */
export interface Session {
  readonly id: string;
  /** SHA-256 of the bearer token — raw tokens are never stored. */
  readonly tokenHash: string;
  readonly createdAt: number;
  lastActiveAt: number;
  freeSpins: FreeSpinsState | null;
  /** Gem Vault bonus awaiting picks; blocks spinning until finished. */
  bonus: ActiveBonus | null;
  lastRound: SpinOutcome | null;
  history: HistoryEntry[];
}
