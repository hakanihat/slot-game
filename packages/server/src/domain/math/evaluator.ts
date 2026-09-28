import {
  MIN_LINE_MATCH,
  type LinePayTable,
  type LineWin,
  type Position,
  type ScatterWin,
  type SymbolId,
} from '@gem-rush/shared';
import type { Grid } from './types.js';

const WILD: SymbolId = 'WILD';
const SCATTER: SymbolId = 'SCATTER';

const payFor = (table: Readonly<Record<3 | 4 | 5, number>>, count: number): number =>
  count >= 3 && count <= 5 ? table[count as 3 | 4 | 5] : 0;

export interface LineEvaluationInput {
  readonly grid: Grid;
  readonly paylines: readonly (readonly number[])[];
  readonly linePays: LinePayTable;
  readonly lineBet: number;
  readonly multiplier: number;
}

/**
 * Left-to-right line evaluation with wild substitution.
 *
 * The line symbol is the first non-wild symbol on the line; wilds then
 * substitute for it. The scatter never forms part of a line. Wilds have no pay
 * of their own, so a line made only of wilds pays nothing.
 */
export function evaluateLines(input: LineEvaluationInput): LineWin[] {
  const { grid, paylines, linePays, lineBet, multiplier } = input;
  const wins: LineWin[] = [];

  paylines.forEach((rows, lineIndex) => {
    const symbols = rows.map((row, reel) => symbolAt(grid, reel, row));
    const lineSymbol = symbols.find((symbol) => symbol !== WILD);
    if (lineSymbol === undefined || lineSymbol === SCATTER) return;

    const table = linePays[lineSymbol];
    if (!table) return;

    let count = 0;
    while (count < symbols.length && (symbols[count] === lineSymbol || symbols[count] === WILD)) {
      count += 1;
    }
    if (count < MIN_LINE_MATCH) return;

    const pay = payFor(table, count);
    if (pay === 0) return;

    wins.push({
      lineIndex,
      symbol: lineSymbol,
      count,
      positions: rows.slice(0, count).map((row, reel) => ({ reel, row })),
      amount: pay * lineBet * multiplier,
    });
  });

  return wins;
}

export interface ScatterEvaluationInput {
  readonly grid: Grid;
  readonly scatterPays: Readonly<Record<3 | 4 | 5, number>>;
  readonly totalBet: number;
  readonly multiplier: number;
}

/** Scatters pay anywhere on the grid, as a multiple of the total bet. */
export function evaluateScatters(input: ScatterEvaluationInput): ScatterWin | null {
  const { grid, scatterPays, totalBet, multiplier } = input;
  const positions: Position[] = [];
  grid.forEach((column, reel) =>
    column.forEach((symbol, row) => {
      if (symbol === SCATTER) positions.push({ reel, row });
    }),
  );

  const pay = payFor(scatterPays, positions.length);
  if (pay === 0) return null;
  return { count: positions.length, positions, amount: pay * totalBet * multiplier };
}

function symbolAt(grid: Grid, reel: number, row: number): SymbolId {
  const symbol = grid[reel]?.[row];
  if (symbol === undefined) throw new RangeError(`No symbol at reel ${reel}, row ${row}`);
  return symbol;
}
