import { describe, expect, it } from 'vitest';
import { GEM_RUSH_MODEL } from '../src/domain/math/reelSets.js';
import { SlotEngine, windowAt } from '../src/domain/math/SlotEngine.js';
import { ScriptedRng } from '../src/domain/rng/ScriptedRng.js';
import { stopsShowing } from './helpers.js';

describe('SlotEngine', () => {
  it('builds the visible window from the stop positions (wrapping around the strip)', () => {
    const strip = GEM_RUSH_MODEL.reelSets.base[0]!;
    const last = strip.length - 1;
    const grid = windowAt(GEM_RUSH_MODEL.reelSets.base, [last, 0, 0, 0, 0], 3);
    expect(grid[0]).toEqual([strip[last], strip[0], strip[1]]);
  });

  it('awards free spins for three or more scatters', () => {
    const stops = stopsShowing(['SCATTER', null, 'SCATTER', null, 'SCATTER']);
    const engine = new SlotEngine(GEM_RUSH_MODEL, new ScriptedRng(stops));
    const result = engine.spin('base', 100);
    expect(result.scatterWin?.count).toBe(3);
    expect(result.freeSpinsAwarded).toBe(10);
    expect(result.totalWin).toBeGreaterThanOrEqual(200);
  });

  it('applies the multiplier in free spins', () => {
    const stops = stopsShowing(['SCATTER', 'SCATTER', 'SCATTER', null, null], 'freeSpins');
    const engine = new SlotEngine(GEM_RUSH_MODEL, new ScriptedRng(stops));
    const result = engine.spin('freeSpins', 100);
    expect(result.multiplier).toBe(3);
    expect(result.scatterWin?.amount).toBe(2 * 100 * 3);
  });
});
