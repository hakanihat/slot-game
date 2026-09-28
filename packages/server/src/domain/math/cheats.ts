import type { CheatScenario, SpinMode, SymbolId } from '@gem-rush/shared';
import type { MathModel, ReelStrip } from './types.js';

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
  const strips = model.reelSets[mode];
  const want: (SymbolId | null)[] =
    scenario === 'freeSpins'
      ? ['SCATTER', null, 'SCATTER', null, 'SCATTER']
      : scenario === 'anticipation'
        ? ['SCATTER', null, 'SCATTER', null, null]
        : ['RUBY', 'RUBY', 'RUBY', 'RUBY', 'RUBY'];
  return strips.map((strip, reel) => stopFor(strip, want[reel] ?? null, model.config.rows));
}

/** Top-row stop for `symbol`, or a scatter-free window when `symbol` is null. */
function stopFor(strip: ReelStrip, symbol: SymbolId | null, rows: number): number {
  const index =
    symbol === null
      ? strip.findIndex((_, i) =>
          Array.from({ length: rows }, (_, r) => strip[(i + r) % strip.length]).every(
            (s) => s !== 'SCATTER',
          ),
        )
      : strip.indexOf(symbol);
  if (index < 0) throw new Error(`Cannot build cheat window for ${symbol ?? 'blank'}`);
  return index;
}
