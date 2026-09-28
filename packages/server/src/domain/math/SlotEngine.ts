import { lineBetFor, type SpinMode } from '@gem-rush/shared';
import type { LineWin, ScatterWin } from '@gem-rush/shared';
import type { Rng } from '../rng/Rng.js';
import { evaluateLines, evaluateScatters } from './evaluator.js';
import type { Grid, MathModel, ReelSet } from './types.js';

export interface EngineResult {
  readonly mode: SpinMode;
  readonly bet: number;
  readonly stops: readonly number[];
  readonly grid: Grid;
  readonly lineWins: readonly LineWin[];
  readonly scatterWin: ScatterWin | null;
  readonly multiplier: number;
  readonly totalWin: number;
  readonly freeSpinsAwarded: number;
}

/**
 * Pure game math: picks reel stops and evaluates the resulting grid.
 * It knows nothing about players, balances or HTTP — which keeps it trivially
 * testable and lets the simulator run millions of spins through the exact
 * same code path production uses.
 */
export class SlotEngine {
  constructor(
    private readonly model: MathModel,
    private readonly rng: Rng,
  ) {}

  spin(mode: SpinMode, bet: number): EngineResult {
    const { config } = this.model;
    const reelSet = this.model.reelSets[mode];
    const stops = reelSet.map((strip) => this.rng.nextInt(strip.length));
    const grid = windowAt(reelSet, stops, config.rows);
    return this.evaluate(mode, bet, stops, grid);
  }

  evaluate(mode: SpinMode, bet: number, stops: readonly number[], grid: Grid): EngineResult {
    const { config } = this.model;
    const multiplier = mode === 'freeSpins' ? config.freeSpins.multiplier : 1;

    const lineWins = evaluateLines({
      grid,
      paylines: config.paylines,
      linePays: config.linePays,
      lineBet: lineBetFor(bet),
      multiplier,
    });
    const scatterWin = evaluateScatters({
      grid,
      scatterPays: config.scatterPays,
      totalBet: bet,
      multiplier,
    });

    const scatterCount = scatterWin?.count ?? 0;
    const freeSpinsAwarded =
      scatterCount >= 3 ? config.freeSpins.award[Math.min(scatterCount, 5) as 3 | 4 | 5] : 0;

    const totalWin = lineWins.reduce((sum, win) => sum + win.amount, 0) + (scatterWin?.amount ?? 0);

    return { mode, bet, stops, grid, lineWins, scatterWin, multiplier, totalWin, freeSpinsAwarded };
  }
}

/** The visible symbols for the given stops: the stop symbol is the top row. */
export function windowAt(reelSet: ReelSet, stops: readonly number[], rows: number): Grid {
  return reelSet.map((strip, reel) => {
    const stop = stops[reel] ?? 0;
    return Array.from({ length: rows }, (_, row) => {
      const symbol = strip[(stop + row) % strip.length];
      if (symbol === undefined) throw new RangeError(`Empty strip on reel ${reel}`);
      return symbol;
    });
  });
}
