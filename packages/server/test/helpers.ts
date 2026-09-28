import type { SpinMode, SymbolId } from '@gem-rush/shared';
import { GEM_RUSH_MODEL } from '../src/domain/math/reelSets.js';

/** Finds a stop per reel whose window shows `symbol` on the top row (or any symbol when `null`). */
export function stopsShowing(
  symbolsPerReel: readonly (SymbolId | null)[],
  mode: SpinMode = 'base',
): number[] {
  return GEM_RUSH_MODEL.reelSets[mode].map((strip, reel) => {
    const wanted = symbolsPerReel[reel];
    if (wanted === null || wanted === undefined) {
      // A stop whose window contains no scatter, so it can't influence the test.
      const index = strip.findIndex((_, i) =>
        [0, 1, 2].every((row) => strip[(i + row) % strip.length] !== 'SCATTER'),
      );
      return index;
    }
    const index = strip.indexOf(wanted);
    if (index < 0) throw new Error(`Reel ${reel} has no ${wanted}`);
    return index;
  });
}
