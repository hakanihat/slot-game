import { SYMBOL_IDS, type SymbolId } from '@gem-rush/shared';
import { Rectangle, type Renderer, type Texture } from 'pixi.js';
import type { SpineSymbolPool } from '../spine/SpineSymbolPool';
import { SYMBOL_ANIMATIONS, SYMBOL_UNIT_SIZE } from '../spine/symbolAssets';

/**
 * Static symbol textures baked from the Spine rig's setup pose.
 *
 * Idle and spinning reels draw these cheap sprites; Spine only runs while a
 * symbol animates. Baking from the rig (instead of keeping separate art)
 * guarantees the static and animated symbol look identical at the swap.
 */
export class SymbolTextures {
  private constructor(
    private readonly textures: ReadonlyMap<SymbolId, Texture>,
    private readonly dataUrls: ReadonlyMap<SymbolId, string>,
  ) {}

  static async bake(renderer: Renderer, pool: SpineSymbolPool): Promise<SymbolTextures> {
    const half = SYMBOL_UNIT_SIZE / 2;
    const frame = new Rectangle(-half, -half, SYMBOL_UNIT_SIZE, SYMBOL_UNIT_SIZE);
    const textures = new Map<SymbolId, Texture>();
    const dataUrls = new Map<SymbolId, string>();

    for (const id of SYMBOL_IDS) {
      const spine = pool.acquire(id);
      spine.state.setAnimation(0, SYMBOL_ANIMATIONS.idle, false);
      spine.update(0);
      const texture = renderer.generateTexture({ target: spine, frame, antialias: true });
      textures.set(id, texture);
      dataUrls.set(id, await renderer.extract.base64(texture));
      pool.release(spine);
    }
    return new SymbolTextures(textures, dataUrls);
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
