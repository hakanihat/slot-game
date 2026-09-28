import { SYMBOL_IDS, type SymbolId } from '@gem-rush/shared';
import { Texture } from 'pixi.js';
import { renderSymbol } from './symbolArt';

/** Renders every symbol once at boot and caches the GPU textures and data URLs. */
export class SymbolTextures {
  private readonly textures = new Map<SymbolId, Texture>();
  private readonly dataUrls = new Map<SymbolId, string>();

  constructor(size: number) {
    for (const id of SYMBOL_IDS) {
      const canvas = renderSymbol(id, size);
      this.textures.set(id, Texture.from(canvas));
      this.dataUrls.set(id, canvas.toDataURL('image/png'));
    }
  }

  texture(id: SymbolId): Texture {
    const texture = this.textures.get(id);
    if (!texture) throw new Error(`Missing texture for ${id}`);
    return texture;
  }

  /** For DOM usage (paytable) — identical artwork to the reels. */
  dataUrl(id: SymbolId): string {
    return this.dataUrls.get(id) ?? '';
  }
}
