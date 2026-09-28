import type { SymbolId } from '@gem-rush/shared';
import type { SymbolTextures } from '../art/SymbolTextures';
import type { SpineSymbolPool } from './SpineSymbolPool';

/**
 * Contract between the game and the symbol rig in `public/spine/`. The files
 * are produced by `npm run spine:build` (tools/spine) but could equally be a
 * Spine Editor export — as long as it honours the names below.
 */
export const SYMBOL_SPINE = {
  skeleton: { alias: 'symbolsSkeleton', src: 'spine/symbols.json' },
  atlas: { alias: 'symbolsAtlas', src: 'spine/symbols.atlas' },
} as const;

/** Animations the game plays. */
export const SYMBOL_ANIMATIONS = {
  /** Setup pose; the static reel sprites are baked from it. */
  idle: 'idle',
  /** One-shot when a Wild or Scatter lands. */
  land: 'land',
  /** Looped while the symbol is part of a win. */
  win: 'win',
} as const;

export type SymbolAnimation = keyof typeof SYMBOL_ANIMATIONS;

/** Skins are named after the game's symbol ids. */
export const skinFor = (id: SymbolId): string => id;

/** Side of the square every symbol is authored in, in Spine units (origin at the centre). */
export const SYMBOL_UNIT_SIZE = 256;

/** Everything a SymbolView needs to render a symbol, static or animated. */
export interface SymbolAssets {
  readonly textures: SymbolTextures;
  readonly pool: SpineSymbolPool;
}
