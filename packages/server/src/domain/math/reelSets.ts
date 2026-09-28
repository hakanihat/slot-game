import { GAME_CONFIG } from '@gem-rush/shared';
import { buildStrip, type StripLayoutRules, type SymbolWeights } from './reelStrips.js';
import type { MathModel, ReelSet } from './types.js';

/**
 * Reel strip weights — THE tuning surface of the game's math.
 * Verify any change with `npm run simulate`, which prints the exact RTP and a
 * Monte Carlo cross-check. See docs/GAME_MATH.md for the current figures.
 */
const ROYALS = { J: 9, Q: 9, K: 8, A: 8 } as const;
const GEMS = { AMETHYST: 5, EMERALD: 5, SAPPHIRE: 4, RUBY: 3 } as const;

/** BONUS lands only on the trigger reels (1, 3, 5); three each ≈ one Gem Vault per 277 spins. */
const BONUS = { BONUS: 3 } as const;

const BASE_WEIGHTS: readonly SymbolWeights[] = [
  { ...ROYALS, ...GEMS, SCATTER: 2, ...BONUS },
  { ...ROYALS, ...GEMS, WILD: 4, SCATTER: 1 },
  { ...ROYALS, ...GEMS, WILD: 4, SCATTER: 2, ...BONUS },
  { ...ROYALS, ...GEMS, WILD: 4, SCATTER: 1 },
  { ...ROYALS, ...GEMS, WILD: 4, SCATTER: 2, ...BONUS },
];

/**
 * Feature strips: fewer royals and more wilds make free spins noticeably
 * richer than the base game. One scatter per reel keeps retriggers rare
 * (and the branching process safely bounded). No BONUS symbols: the Gem Vault
 * is a base-game feature.
 */
const FS_ROYALS = { J: 7, Q: 6, K: 6, A: 4 } as const;
const FS_GEMS = { AMETHYST: 4, EMERALD: 4, SAPPHIRE: 3, RUBY: 2 } as const;

const FREE_SPINS_WEIGHTS: readonly SymbolWeights[] = [
  { ...FS_ROYALS, ...FS_GEMS, SCATTER: 1 },
  { ...FS_ROYALS, ...FS_GEMS, WILD: 5, SCATTER: 1 },
  { ...FS_ROYALS, ...FS_GEMS, WILD: 5, SCATTER: 1 },
  { ...FS_ROYALS, ...FS_GEMS, WILD: 5, SCATTER: 1 },
  { ...FS_ROYALS, ...FS_GEMS, WILD: 5, SCATTER: 1 },
];

const LAYOUT_RULES: StripLayoutRules = {
  spacedSymbols: ['SCATTER', 'BONUS'],
  windowSize: GAME_CONFIG.rows,
};

const buildReelSet = (weights: readonly SymbolWeights[], seedBase: number): ReelSet =>
  weights.map((w, reel) => buildStrip(w, seedBase + reel, LAYOUT_RULES));

export const GEM_RUSH_MODEL: MathModel = {
  config: GAME_CONFIG,
  reelSets: {
    base: buildReelSet(BASE_WEIGHTS, 1_000),
    freeSpins: buildReelSet(FREE_SPINS_WEIGHTS, 2_000),
  },
};
