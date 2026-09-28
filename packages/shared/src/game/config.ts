import { PAYLINES } from './paylines.js';
import { FREE_SPINS_AWARD, LINE_PAYS, SCATTER_PAYS } from './paytable.js';
import { SYMBOLS } from './symbols.js';

/**
 * The public, immutable definition of the game. Everything a client needs to
 * render reels, a paytable and a bet selector lives here. Reel strips are
 * deliberately *not* part of it: they are server-side secrets that define the
 * odds and are never shipped to the browser.
 */
export const GAME_CONFIG = {
  id: 'gem-rush',
  title: 'Gem Rush',
  reels: 5,
  rows: 3,
  paylines: PAYLINES,
  symbols: SYMBOLS,
  linePays: LINE_PAYS,
  scatterPays: SCATTER_PAYS,
  freeSpins: {
    award: FREE_SPINS_AWARD,
    /** Every win during Free Spins is multiplied by this value. */
    multiplier: 3,
  },
  /** Reels (0-based) on which the Wild can land. */
  wildReels: [1, 2, 3, 4],
  /**
   * Allowed total bets in minor currency units (cents). Every level is a
   * multiple of the line count so the line bet is always a whole number and
   * all money math stays in integers.
   */
  betLevels: [20, 40, 100, 200, 400, 1000, 2000],
  defaultBetIndex: 2,
  currency: 'EUR',
} as const;

export type GameConfig = typeof GAME_CONFIG;

export const lineBetFor = (totalBet: number): number => totalBet / GAME_CONFIG.paylines.length;
