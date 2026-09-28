import type { GameConfig } from '../game/config.js';
import type { SymbolId } from '../game/symbols.js';

/**
 * HTTP contract between client and server. All money values are integers in
 * minor currency units (cents) to avoid floating point rounding errors.
 */

/** `GET /api/game`: the public game definition plus figures derived from the server-side math. */
export type GameInfo = GameConfig & {
  /** Theoretical return to player (0-1), computed from the live reel strips. */
  readonly rtp: number;
  /** True only on QA servers that honour forced outcomes; the client then shows its QA panel. */
  readonly cheatsEnabled: boolean;
};

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
  /** BONUS symbols that triggered the Gem Vault bonus on this spin, or `null`. */
  readonly bonusTrigger: { readonly positions: readonly Position[] } | null;
}

/** What a picked vault tile revealed. Prize amounts already include the bet. */
export type BonusPrize =
  | { readonly kind: 'prize'; readonly multiplier: number; readonly amount: number }
  | { readonly kind: 'collect' };

export interface BonusPick {
  readonly tile: number;
  readonly prize: BonusPrize;
}

/**
 * Public view of a Gem Vault bonus in progress. The hidden prize order lives
 * only on the server; clients see what has been revealed so far.
 */
export interface BonusState {
  readonly bet: number;
  readonly tiles: number;
  readonly picks: readonly BonusPick[];
  readonly totalWin: number;
}

export interface BonusPickRequest {
  readonly tile: number;
}

export interface BonusPickResponse {
  readonly pick: BonusPick;
  readonly balance: number;
  /** State after this pick; `null` once a COLLECT ended the bonus. */
  readonly bonus: BonusState | null;
  /** Present on the final pick: total win and what the unpicked tiles held. */
  readonly finished: {
    readonly totalWin: number;
    readonly unrevealed: readonly BonusPick[];
  } | null;
}

export interface SessionState {
  readonly balance: number;
  readonly currency: string;
  /** Present while a Free Spins feature is in progress, so the client can resume it after a reload. */
  readonly freeSpins: FreeSpinsState | null;
  /** Present while a Gem Vault bonus awaits picks — resumed after a reload. */
  readonly bonus: BonusState | null;
  readonly lastRound: SpinOutcome | null;
}

export interface CreateSessionResponse {
  readonly token: string;
  readonly state: SessionState;
}

/**
 * Forced outcomes for development and QA ("cheat tool"). Only honoured when
 * the server runs with `ENABLE_CHEATS=true` — never in production.
 */
export const CHEAT_SCENARIOS = ['freeSpins', 'bonus', 'bigWin', 'anticipation'] as const;
export type CheatScenario = (typeof CHEAT_SCENARIOS)[number];

export interface SpinRequest {
  readonly bet: number;
  readonly cheat?: CheatScenario;
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
  /** Bonus triggered by this spin, to be played before spinning again. */
  readonly bonus: BonusState | null;
  readonly featureEnded: FeatureSummary | null;
}

export interface HistoryEntry {
  readonly roundId: string;
  readonly timestamp: string;
  readonly mode: SpinMode | 'bonus';
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
  | 'BONUS_IN_PROGRESS'
  | 'NO_BONUS'
  | 'INVALID_PICK'
  | 'FORBIDDEN'
  | 'INTERNAL';

export interface ApiErrorBody {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
  };
}
