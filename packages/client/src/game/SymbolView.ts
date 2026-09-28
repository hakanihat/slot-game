import type { SymbolId } from '@gem-rush/shared';
import type { Spine } from '@esotericsoftware/spine-pixi-v8';
import { Container, Graphics, Sprite } from 'pixi.js';
import {
  SYMBOL_ANIMATIONS,
  SYMBOL_UNIT_SIZE,
  type SymbolAnimation,
  type SymbolAssets,
} from './spine/symbolAssets';

/**
 * One cell on a reel. Shows a static sprite by default and swaps in a pooled
 * Spine instance only while the symbol animates (land / win).
 */
export class SymbolView extends Container {
  private readonly sprite: Sprite;
  private readonly highlight: Graphics;
  private spine: Spine | null = null;
  private playing: SymbolAnimation | null = null;
  private id: SymbolId;

  constructor(
    private readonly assets: SymbolAssets,
    private readonly cellSize: number,
    id: SymbolId,
  ) {
    super();
    this.id = id;

    this.highlight = new Graphics()
      .roundRect(
        -cellSize * 0.46,
        -cellSize * 0.46,
        cellSize * 0.92,
        cellSize * 0.92,
        cellSize * 0.14,
      )
      .fill({ color: 0xffffff, alpha: 0.06 })
      .stroke({ color: 0xffd54a, width: 4, alpha: 0.9 });
    this.highlight.visible = false;

    this.sprite = new Sprite({ texture: assets.textures.texture(id), anchor: 0.5 });
    this.sprite.width = this.sprite.height = cellSize * 0.9;

    this.addChild(this.highlight, this.sprite);
  }

  get symbolId(): SymbolId {
    return this.id;
  }

  setSymbol(id: SymbolId): void {
    if (id === this.id) return;
    this.releaseSpine();
    this.id = id;
    this.sprite.texture = this.assets.textures.texture(id);
  }

  setDimmed(dimmed: boolean): void {
    this.sprite.alpha = dimmed ? 0.35 : 1;
  }

  /** Loops the rig's `win` animation until {@link stopWinAnimation}. */
  startWinAnimation(): void {
    this.highlight.visible = true;
    if (this.playing !== 'win') void this.play('win', true);
  }

  stopWinAnimation(): void {
    this.highlight.visible = false;
    this.releaseSpine();
    this.setDimmed(false);
  }

  /** One-shot landing flourish for special symbols; resolves when it finishes. */
  land(): Promise<void> {
    if (this.playing === 'win') return Promise.resolve();
    return this.play('land', false);
  }

  private play(animation: SymbolAnimation, loop: boolean): Promise<void> {
    const spine = this.spine ?? this.attachSpine();
    this.playing = animation;
    const entry = spine.state.setAnimation(0, SYMBOL_ANIMATIONS[animation], loop);
    spine.update(0);
    if (loop) return Promise.resolve();

    return new Promise((resolve) => {
      entry.listener = {
        complete: () => {
          if (this.spine === spine && this.playing === animation) this.releaseSpine();
          resolve();
        },
        // Replaced by another animation or the spine was recycled.
        end: () => resolve(),
      };
    });
  }

  private attachSpine(): Spine {
    const spine = this.assets.pool.acquire(this.id);
    spine.scale.set((this.cellSize * 0.9) / SYMBOL_UNIT_SIZE);
    this.addChild(spine);
    this.sprite.visible = false;
    this.spine = spine;
    return spine;
  }

  private releaseSpine(): void {
    if (!this.spine) return;
    this.assets.pool.release(this.spine);
    this.spine = null;
    this.playing = null;
    this.sprite.visible = true;
  }

  override destroy(): void {
    this.releaseSpine();
    super.destroy({ children: true });
  }
}
