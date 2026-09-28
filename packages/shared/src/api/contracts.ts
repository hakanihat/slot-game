import type { SymbolId } from '../game/symbols.js';

/**
 * HTTP contract between client and server. All money values are integers in
 * minor currency units (cents) to avoid floating point rounding errors.
 */

/** A grid position: `reel` is the column (0-4), `row` the visible row (0-2, top to bottom). */
export interface Position {
  readonly reel: number;
  readonly row: number;
}

export interface LineWin {
  /** 0-based index into `GAME_CONFIG.paylines`. */
  readonly lineIndex: number;
  readonly symbol: SymbolId;
  readonly count: number;
  readonly positions: readonly Position[];
  /** Amount after any feature multiplier has been applied. */
  readonly amount: number;
}

export interface ScatterWin {
  readonly count: number;
  readonly positions: readonly Position[];
  readonly amount: number;
}

export type SpinMode = 'base' | 'freeSpins';

export interface FreeSpinsState {
  /** Spins still to be played. */
  readonly remaining: number;
  /** Spins awarded in total for this feature (including retriggers). */
  readonly total: number;
  /** Total bet locked in when the feature was triggered. */
  readonly bet: number;
  /** Running win accumulated over the feature so far. */
  readonly totalWin: number;
  readonly multiplier: number;
}

export interface SpinOutcome {
  readonly roundId: string;
  readonly mode: SpinMode;
  readonly bet: number;
  /** Stop index per reel on the server-side strip — useful for audits and replays. */
  readonly stops: readonly number[];
  /** Visible symbols, `grid[reel][row]`. */
  readonly grid: readonly (readonly SymbolId[])[];
  readonly lineWins: readonly LineWin[];
  readonly scatterWin: ScatterWin | null;
  readonly multiplier: number;
  readonly totalWin: number;
  /** Free spins awarded by *this* spin (trigger or retrigger), 0 otherwise. */
  readonly freeSpinsAwarded: number;
}

export interface SessionState {
  readonly balance: number;
  readonly currency: string;
  /** Present while a Free Spins feature is in progress, so the client can resume it after a reload. */
  readonly freeSpins: FreeSpinsState | null;
  readonly lastRound: SpinOutcome | null;
}

export interface CreateSessionResponse {
  readonly token: string;
  readonly state: SessionState;
}

export interface SpinRequest {
  readonly bet: number;
}

/** Summary of a Free Spins feature, sent with the spin that completed it. */
export interface FeatureSummary {
  readonly spinsPlayed: number;
  readonly totalWin: number;
}

export interface SpinResponse {
  readonly outcome: SpinOutcome;
  /** Balance after the round has been settled. */
  readonly balance: number;
  /** Feature state *after* this spin; `null` when no feature is in progress. */
  readonly freeSpins: FreeSpinsState | null;
  readonly featureEnded: FeatureSummary | null;
}

export interface HistoryEntry {
  readonly roundId: string;
  readonly timestamp: string;
  readonly mode: SpinMode;
  readonly bet: number;
  readonly win: number;
  readonly balanceAfter: number;
}

export interface HistoryResponse {
  readonly rounds: readonly HistoryEntry[];
}

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'INSUFFICIENT_FUNDS'
  | 'INVALID_BET'
  | 'REFILL_NOT_ALLOWED'
  | 'NOT_FOUND'
  | 'INTERNAL';

export interface ApiErrorBody {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
  };
}
