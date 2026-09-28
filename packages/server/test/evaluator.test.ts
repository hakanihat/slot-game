import { LINE_PAYS, PAYLINES, SCATTER_PAYS, type SymbolId } from '@gem-rush/shared';
import { describe, expect, it } from 'vitest';
import { evaluateLines, evaluateScatters } from '../src/domain/math/evaluator.js';

/** Builds a grid from rows (as players read it) into the engine's `grid[reel][row]` layout. */
const gridFromRows = (rows: SymbolId[][]): SymbolId[][] =>
  rows[0]!.map((_, reel) => rows.map((row) => row[reel]!));

const lines = (rows: SymbolId[][], multiplier = 1) =>
  evaluateLines({
    grid: gridFromRows(rows),
    paylines: PAYLINES,
    linePays: LINE_PAYS,
    lineBet: 5,
    multiplier,
  });

describe('evaluateLines', () => {
  it('pays three of a kind from the leftmost reel', () => {
    const wins = lines([
      ['J', 'Q', 'K', 'A', 'J'],
      ['RUBY', 'RUBY', 'RUBY', 'Q', 'K'],
      ['A', 'K', 'Q', 'J', 'EMERALD'],
    ]);
    const middle = wins.find((w) => w.lineIndex === 0);
    expect(middle).toMatchObject({ symbol: 'RUBY', count: 3, amount: 50 * 5 });
    expect(middle?.positions).toEqual([
      { reel: 0, row: 1 },
      { reel: 1, row: 1 },
      { reel: 2, row: 1 },
    ]);
  });

  it('lets wilds substitute and extend a line', () => {
    const wins = lines([
      ['J', 'Q', 'K', 'A', 'J'],
      ['SAPPHIRE', 'WILD', 'SAPPHIRE', 'WILD', 'SAPPHIRE'],
      ['A', 'K', 'Q', 'J', 'EMERALD'],
    ]);
    expect(wins.find((w) => w.lineIndex === 0)).toMatchObject({
      symbol: 'SAPPHIRE',
      count: 5,
      amount: 400 * 5,
    });
  });

  it('does not pay matches that do not start on reel 1', () => {
    const wins = lines([
      ['J', 'Q', 'K', 'A', 'J'],
      ['K', 'RUBY', 'RUBY', 'RUBY', 'RUBY'],
      ['A', 'K', 'Q', 'J', 'EMERALD'],
    ]);
    expect(wins.find((w) => w.lineIndex === 0)).toBeUndefined();
  });

  it('never forms a line with scatters', () => {
    const wins = lines([
      ['J', 'Q', 'K', 'A', 'J'],
      ['SCATTER', 'WILD', 'WILD', 'Q', 'K'],
      ['A', 'K', 'Q', 'J', 'EMERALD'],
    ]);
    expect(wins.find((w) => w.lineIndex === 0)).toBeUndefined();
  });

  it('applies the feature multiplier', () => {
    const rows: SymbolId[][] = [
      ['J', 'Q', 'K', 'A', 'J'],
      ['RUBY', 'RUBY', 'RUBY', 'Q', 'K'],
      ['A', 'K', 'Q', 'J', 'EMERALD'],
    ];
    const base = lines(rows).find((w) => w.lineIndex === 0)!;
    const boosted = lines(rows, 3).find((w) => w.lineIndex === 0)!;
    expect(boosted.amount).toBe(base.amount * 3);
  });

  it('evaluates every payline independently', () => {
    const wins = lines([
      ['A', 'A', 'A', 'A', 'A'],
      ['A', 'A', 'A', 'A', 'A'],
      ['A', 'A', 'A', 'A', 'A'],
    ]);
    expect(wins).toHaveLength(PAYLINES.length);
    expect(wins.every((w) => w.count === 5 && w.amount === 125 * 5)).toBe(true);
  });
});

describe('evaluateScatters', () => {
  const scatters = (rows: SymbolId[][], multiplier = 1) =>
    evaluateScatters({
      grid: gridFromRows(rows),
      scatterPays: SCATTER_PAYS,
      totalBet: 100,
      multiplier,
    });

  it('pays scatters anywhere as a multiple of total bet', () => {
    const win = scatters([
      ['SCATTER', 'Q', 'K', 'A', 'J'],
      ['K', 'Q', 'SCATTER', 'Q', 'K'],
      ['A', 'K', 'Q', 'J', 'SCATTER'],
    ]);
    expect(win).toMatchObject({ count: 3, amount: 2 * 100 });
    expect(win?.positions).toHaveLength(3);
  });

  it('returns null below three scatters', () => {
    expect(
      scatters([
        ['SCATTER', 'Q', 'K', 'A', 'J'],
        ['K', 'Q', 'SCATTER', 'Q', 'K'],
        ['A', 'K', 'Q', 'J', 'A'],
      ]),
    ).toBeNull();
  });
});
