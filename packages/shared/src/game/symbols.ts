/**
 * Symbol catalogue. Ids are human-readable strings so that network payloads,
 * logs and test fixtures stay self-describing.
 */
export const SYMBOL_IDS = [
  'J',
  'Q',
  'K',
  'A',
  'AMETHYST',
  'EMERALD',
  'SAPPHIRE',
  'RUBY',
  'WILD',
  'SCATTER',
] as const;

export type SymbolId = (typeof SYMBOL_IDS)[number];

/**
 * - `low` / `high`: regular paying symbols (royals vs. gems).
 * - `wild`: substitutes for every regular symbol on a payline.
 * - `scatter`: pays anywhere on the grid and triggers the Free Spins feature.
 */
export type SymbolKind = 'low' | 'high' | 'wild' | 'scatter';

export interface SymbolDefinition {
  readonly id: SymbolId;
  readonly name: string;
  readonly kind: SymbolKind;
}

export const SYMBOLS: Readonly<Record<SymbolId, SymbolDefinition>> = {
  J: { id: 'J', name: 'Jack', kind: 'low' },
  Q: { id: 'Q', name: 'Queen', kind: 'low' },
  K: { id: 'K', name: 'King', kind: 'low' },
  A: { id: 'A', name: 'Ace', kind: 'low' },
  AMETHYST: { id: 'AMETHYST', name: 'Amethyst', kind: 'high' },
  EMERALD: { id: 'EMERALD', name: 'Emerald', kind: 'high' },
  SAPPHIRE: { id: 'SAPPHIRE', name: 'Sapphire', kind: 'high' },
  RUBY: { id: 'RUBY', name: 'Ruby', kind: 'high' },
  WILD: { id: 'WILD', name: 'Wild', kind: 'wild' },
  SCATTER: { id: 'SCATTER', name: 'Star Scatter', kind: 'scatter' },
};

export const isSymbolId = (value: unknown): value is SymbolId =>
  typeof value === 'string' && (SYMBOL_IDS as readonly string[]).includes(value);
