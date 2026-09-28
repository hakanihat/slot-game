import type { CheatScenario, SpinMode, SymbolId } from '@gem-rush/shared';
import type { MathModel, ReelStrip } from './types.js';

/** Symbols that start features; cheat windows keep them out unless requested. */
const FEATURE_SYMBOLS: readonly SymbolId[] = ['SCATTER', 'BONUS'];

const SCENARIOS: Readonly<Record<CheatScenario, readonly (SymbolId | null)[]>> = {
  freeSpins: ['SCATTER', null, 'SCATTER', null, 'SCATTER'],
  bonus: ['BONUS', null, 'BONUS', null, 'BONUS'],
  anticipation: ['SCATTER', null, 'SCATTER', null, null],
  bigWin: ['RUBY', 'RUBY', 'RUBY', 'RUBY', 'RUBY'],
};

/**
 * Reel stops that produce a given scenario on the live strips. Deriving them
 * from the strips (instead of hard-coding indices) keeps cheats working after
 * any math re-tune.
 */
export function stopsForScenario(
  model: MathModel,
  mode: SpinMode,
  scenario: CheatScenario,
): number[] {
  const want = SCENARIOS[scenario];
  return model.reelSets[mode].map((strip, reel) =>
    stopFor(strip, want[reel] ?? null, model.config.rows),
  );
}

/**
 * Stop whose window shows `symbol` on the top row (or nothing in particular
 * when null) and no *other* feature symbol, so a scenario never accidentally
 * triggers a second feature.
 */
function stopFor(strip: ReelStrip, symbol: SymbolId | null, rows: number): number {
  const index = strip.findIndex((top, i) => {
    if (symbol !== null && top !== symbol) return false;
    const window = Array.from({ length: rows }, (_, r) => strip[(i + r) % strip.length]);
    return window.every((s, r) => !(s && FEATURE_SYMBOLS.includes(s)) || (r === 0 && s === symbol));
  });
  if (index < 0) throw new Error(`Cannot build cheat window for ${symbol ?? 'blank'}`);
  return index;
}
