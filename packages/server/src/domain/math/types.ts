import type { GameConfig, SpinMode, SymbolId } from '@gem-rush/shared';

/** One reel strip: the circular sequence of symbols a reel can stop on. */
export type ReelStrip = readonly SymbolId[];

/** One strip per reel. */
export type ReelSet = readonly ReelStrip[];

/**
 * Everything that defines the odds of the game. Reel sets are per mode so the
 * feature can use its own strips — the main lever for tuning feature value.
 */
export interface MathModel {
  readonly config: GameConfig;
  readonly reelSets: Readonly<Record<SpinMode, ReelSet>>;
}

export type Grid = readonly (readonly SymbolId[])[];
