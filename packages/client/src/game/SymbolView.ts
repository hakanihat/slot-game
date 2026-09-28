import type { SymbolId } from '@gem-rush/shared';
import { Container, Graphics, Sprite, Ticker } from 'pixi.js';
import { Ease, tween } from '../core/tween';
import type { SymbolTextures } from './art/SymbolTextures';

/** One cell on a reel: the symbol sprite plus its win highlight. */
export class SymbolView extends Container {
  private readonly sprite: Sprite;
  private readonly highlight: Graphics;
  private id: SymbolId;
  private pulseTime = 0;

  constructor(
    private readonly textures: SymbolTextures,
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
      .fill({ color: 0xffffff, alpha: 0.08 })
      .stroke({ color: 0xffd54a, width: 4, alpha: 0.95 });
    this.highlight.visible = false;

    this.sprite = new Sprite({ texture: textures.texture(id), anchor: 0.5 });
    this.sprite.width = this.sprite.height = cellSize * 0.9;

    this.addChild(this.highlight, this.sprite);
  }

  get symbolId(): SymbolId {
    return this.id;
  }

  setSymbol(id: SymbolId): void {
    if (id === this.id) return;
    this.id = id;
    this.sprite.texture = this.textures.texture(id);
  }

  setDimmed(dimmed: boolean): void {
    this.sprite.alpha = dimmed ? 0.35 : 1;
  }

  /** Looping pulse for winning symbols — reads clearly even at small sizes. */
  startWinAnimation(): void {
    if (this.highlight.visible) return;
    this.highlight.visible = true;
    this.pulseTime = 0;
    Ticker.shared.add(this.pulse, this);
  }

  stopWinAnimation(): void {
    Ticker.shared.remove(this.pulse, this);
    this.highlight.visible = false;
    this.sprite.scale.set(this.baseScale);
    this.setDimmed(false);
  }

  /** Short squash-and-stretch when a special symbol lands (scatter/wild). */
  async land(): Promise<void> {
    const s = this.baseScale;
    this.sprite.scale.set(s * 1.25);
    await tween(this.sprite.scale, { x: s, y: s }, { duration: 320, ease: Ease.elasticOut })
      .finished;
  }

  private get baseScale(): number {
    return (this.cellSize * 0.9) / this.sprite.texture.width;
  }

  private pulse(ticker: Ticker): void {
    this.pulseTime += ticker.deltaMS / 1000;
    const s = this.baseScale * (1 + 0.07 * Math.sin(this.pulseTime * Math.PI * 2 * 1.4));
    this.sprite.scale.set(s);
    this.highlight.alpha = 0.6 + 0.4 * Math.sin(this.pulseTime * Math.PI * 2 * 1.4);
  }

  override destroy(): void {
    Ticker.shared.remove(this.pulse, this);
    super.destroy({ children: true });
  }
}
