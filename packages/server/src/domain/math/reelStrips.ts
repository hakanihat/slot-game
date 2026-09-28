import type { SymbolId } from '@gem-rush/shared';
import { SeededRng } from '../rng/SeededRng.js';
import type { ReelStrip } from './types.js';

export type SymbolWeights = Readonly<Partial<Record<SymbolId, number>>>;

export interface StripLayoutRules {
  /** Symbols that may appear at most once in any window of `windowSize` consecutive stops. */
  readonly spacedSymbols: readonly SymbolId[];
  readonly windowSize: number;
}

const MAX_LAYOUT_ATTEMPTS = 10_000;

/**
 * Builds a reel strip from symbol counts.
 *
 * Only the *counts* affect the odds (every stop is equally likely), so we
 * author strips as weights — easy to tune and review — and derive the order
 * with a seeded shuffle. The seed makes the layout reproducible, and the
 * layout rules keep things fair-looking, e.g. never two scatters in view on
 * the same reel (which would also break the "max one scatter per reel" rule
 * the math relies on).
 */
export function buildStrip(
  weights: SymbolWeights,
  seed: number,
  rules: StripLayoutRules,
): ReelStrip {
  const symbols: SymbolId[] = [];
  for (const [symbol, count] of Object.entries(weights) as [SymbolId, number][]) {
    for (let i = 0; i < count; i += 1) symbols.push(symbol);
  }

  const rng = new SeededRng(seed);
  for (let attempt = 0; attempt < MAX_LAYOUT_ATTEMPTS; attempt += 1) {
    shuffleInPlace(symbols, rng);
    if (satisfiesSpacing(symbols, rules)) return Object.freeze([...symbols]);
  }
  throw new Error(`Could not lay out reel strip (seed ${seed}) within spacing rules`);
}

function shuffleInPlace<T>(items: T[], rng: SeededRng): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1);
    [items[i], items[j]] = [items[j] as T, items[i] as T];
  }
}

/** Checks every circular window of `windowSize` stops. */
export function satisfiesSpacing(strip: readonly SymbolId[], rules: StripLayoutRules): boolean {
  const { spacedSymbols, windowSize } = rules;
  for (let start = 0; start < strip.length; start += 1) {
    for (const symbol of spacedSymbols) {
      let seen = 0;
      for (let offset = 0; offset < windowSize; offset += 1) {
        if (strip[(start + offset) % strip.length] === symbol) seen += 1;
      }
      if (seen > 1) return false;
    }
  }
  return true;
}
