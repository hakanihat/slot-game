import type { SymbolId } from '@gem-rush/shared';
import { BlurFilter, Container, Graphics, Ticker } from 'pixi.js';
import { Ease, tween, type TweenHandle } from '../core/tween';
import type { SymbolTextures } from './art/SymbolTextures';
import { SymbolView } from './SymbolView';

type ReelPhase = 'idle' | 'spinning' | 'landing';

/**
 * One reel column. It holds `rows + 2` symbol views: a buffer above and below
 * the visible window, so the column can scroll seamlessly. While spinning,
 * symbols leaving the bottom are recycled to the top with the next symbol
 * from a feed — random filler until a stop is requested, then the target
 * symbols from the server result, so the reel lands exactly on the outcome.
 */
export class ReelView extends Container {
  private readonly views: SymbolView[];
  private readonly blur = new BlurFilter({ strengthX: 0, strengthY: 0, quality: 2 });
  private readonly glow: Graphics;
  private readonly content = new Container();
  private accelerate: TweenHandle | null = null;
  private phase: ReelPhase = 'idle';
  /** Scroll offset in px within one cell, and speed in cells/second. */
  private readonly motion = { offset: 0, speed: 0 };
  private readonly stopQueue: SymbolId[] = [];
  private stopRequested = false;
  private onLanded: (() => void) | null = null;

  constructor(
    textures: SymbolTextures,
    private readonly cellSize: number,
    private readonly rows: number,
    private readonly randomSymbol: () => SymbolId,
  ) {
    super();

    this.glow = new Graphics()
      .rect(0, 0, cellSize, cellSize * rows)
      .fill({ color: 0xff3fb4, alpha: 0.18 })
      .stroke({ color: 0xff8ad8, width: 4, alpha: 0.9 });
    this.glow.visible = false;

    const content = this.content;
    const mask = new Graphics().rect(0, 0, cellSize, cellSize * rows).fill(0xffffff);
    content.mask = mask;
    this.views = Array.from(
      { length: rows + 2 },
      () => new SymbolView(textures, cellSize, randomSymbol()),
    );
    content.addChild(...this.views);

    this.addChild(this.glow, content, mask);
    this.layout();
  }

  /** Visible symbol view at `row` (0 = top). */
  viewAt(row: number): SymbolView {
    const view = this.views[row + 1];
    if (!view) throw new RangeError(`Row ${row} out of range`);
    return view;
  }

  /** Shows `symbols` immediately (initial state / session restore). */
  setSymbols(symbols: readonly SymbolId[]): void {
    symbols.forEach((id, row) => this.viewAt(row).setSymbol(id));
  }

  /** Enters the spinning phase immediately; the visible motion starts after `delayMs`. */
  async startSpin(cellsPerSecond: number, delayMs = 0): Promise<void> {
    this.phase = 'spinning';
    this.stopRequested = false;
    this.stopQueue.length = 0;
    Ticker.shared.add(this.update, this);
    // The motion blur filter only exists while spinning; idle reels render at full cost-free sharpness.
    this.content.filters = [this.blur];

    // Wind-up: a small upward tug before the reel accelerates down (anticipation principle).
    await tween(
      this.motion,
      { offset: -this.cellSize * 0.18 },
      {
        duration: 110,
        delay: delayMs,
        ease: Ease.quadOut,
        onUpdate: () => this.layout(),
      },
    ).finished;
    this.accelerate = tween(
      this.motion,
      { speed: cellsPerSecond },
      { duration: 220, ease: Ease.quadIn },
    );
    await this.accelerate.finished;
  }

  /** Queues the result and resolves once the reel has settled on it. */
  stop(target: readonly SymbolId[]): Promise<void> {
    if (this.phase !== 'spinning') {
      this.setSymbols(target);
      return Promise.resolve();
    }
    // Symbols enter at the top, so the bottom row must be fed first; one more
    // filler becomes the buffer symbol above the window.
    this.stopQueue.push(...[...target].reverse(), this.randomSymbol());
    this.stopRequested = true;
    return new Promise((resolve) => (this.onLanded = resolve));
  }

  setAnticipation(active: boolean): void {
    this.glow.visible = active;
  }

  private update(ticker: Ticker): void {
    if (this.phase !== 'spinning') return;
    this.motion.offset += this.motion.speed * this.cellSize * (ticker.deltaMS / 1000);
    this.blur.strengthY = Math.min(this.motion.speed * 0.6, 14);

    while (this.motion.offset >= this.cellSize) {
      this.motion.offset -= this.cellSize;
      const landed = this.shift();
      if (landed) {
        void this.land();
        return;
      }
    }
    this.layout();
  }

  /** Recycles the bottom view to the top. Returns true once the stop target is in place. */
  private shift(): boolean {
    const recycled = this.views.pop() as SymbolView;
    this.views.unshift(recycled);
    if (this.stopRequested) {
      recycled.setSymbol(this.stopQueue.shift() ?? this.randomSymbol());
      return this.stopQueue.length === 0;
    }
    recycled.setSymbol(this.randomSymbol());
    return false;
  }

  private async land(): Promise<void> {
    this.phase = 'landing';
    Ticker.shared.remove(this.update, this);
    this.accelerate?.cancel();
    this.motion.speed = 0;
    this.content.filters = [];
    this.setAnticipation(false);

    // Overshoot slightly past the rest position, then spring back.
    this.motion.offset = this.cellSize * 0.16;
    this.layout();
    await tween(
      this.motion,
      { offset: 0 },
      {
        duration: 260,
        ease: Ease.backOut,
        onUpdate: () => this.layout(),
      },
    ).finished;

    this.phase = 'idle';
    const resolve = this.onLanded;
    this.onLanded = null;
    resolve?.();
  }

  private layout(): void {
    this.views.forEach((view, i) => {
      view.x = this.cellSize / 2;
      view.y = (i - 1) * this.cellSize + this.cellSize / 2 + this.motion.offset;
    });
  }

  override destroy(): void {
    Ticker.shared.remove(this.update, this);
    super.destroy({ children: true });
  }
}
