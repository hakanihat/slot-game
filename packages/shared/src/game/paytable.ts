import type { SymbolId } from './symbols.js';

/**
 * Line pays, expressed as multiples of the *line bet* (total bet / lines),
 * indexed by the number of consecutive matching symbols from reel 1.
 */
export type LinePayTable = Readonly<Partial<Record<SymbolId, Readonly<Record<3 | 4 | 5, number>>>>>;

export const LINE_PAYS: LinePayTable = {
  J: { 3: 5, 4: 15, 5: 50 },
  Q: { 3: 5, 4: 20, 5: 75 },
  K: { 3: 10, 4: 25, 5: 100 },
  A: { 3: 10, 4: 30, 5: 125 },
  AMETHYST: { 3: 15, 4: 50, 5: 200 },
  EMERALD: { 3: 20, 4: 75, 5: 300 },
  SAPPHIRE: { 3: 25, 4: 100, 5: 400 },
  RUBY: { 3: 50, 4: 200, 5: 1000 },
};

/** Scatter pays, expressed as multiples of the *total bet*, by scatter count anywhere. */
export const SCATTER_PAYS: Readonly<Record<3 | 4 | 5, number>> = { 3: 2, 4: 10, 5: 50 };

/** Free spins awarded by scatter count (on trigger and on retrigger). */
export const FREE_SPINS_AWARD: Readonly<Record<3 | 4 | 5, number>> = { 3: 10, 4: 15, 5: 20 };

/**
 * Gem Vault pick bonus. The tiles hide `prizes` (multiples of the total bet)
 * and `collects` COLLECT tiles in a random order decided by the server when the
 * bonus triggers; the player picks until a COLLECT appears. The first pick is
 * always a prize so the feature never pays nothing.
 */
export const BONUS_GAME = {
  /** Reels (0-based) that must all show a BONUS symbol to trigger the game. */
  triggerReels: [0, 2, 4],
  prizes: [1, 2, 2, 3, 3, 5, 5, 10, 15, 50],
  collects: 2,
} as const;

export const BONUS_TILES = BONUS_GAME.prizes.length + BONUS_GAME.collects;

/**
 * Expected bonus win in multiples of the total bet. With the first pick forced
 * to be a prize, every other prize is revealed before the first COLLECT with
 * probability 1 / (collects + 1).
 */
export function expectedBonusMultiplier(
  game: { readonly prizes: readonly number[]; readonly collects: number } = BONUS_GAME,
): number {
  const sum = game.prizes.reduce((a, b) => a + b, 0);
  const mean = sum / game.prizes.length;
  return mean + (sum - mean) / (game.collects + 1);
}

export const MIN_LINE_MATCH = 3;
export const MIN_SCATTERS_FOR_FEATURE = 3;
