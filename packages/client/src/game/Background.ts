import { Container, FillGradient, Graphics, Sprite, Ticker, type Texture } from 'pixi.js';

interface Mote {
  readonly sprite: Sprite;
  readonly speed: number;
  readonly phase: number;
}

type Theme = 'base' | 'feature';

const THEMES: Readonly<Record<Theme, { top: string; bottom: string; tint: number }>> = {
  base: { top: '#1a0f3d', bottom: '#05030f', tint: 0x9fc4ff },
  feature: { top: '#4a0a3f', bottom: '#12020f', tint: 0xff9fe0 },
};

/**
 * Full-viewport backdrop with drifting sparkles. The theme swaps during Free
 * Spins so the player always knows which mode they're in at a glance.
 */
export class Background extends Container {
  private readonly gradient = new Graphics();
  private readonly motes: Mote[] = [];
  private theme: Theme = 'base';
  private time = 0;
  private viewWidth = 1;
  private viewHeight = 1;

  constructor(
    private readonly glowTexture: Texture,
    moteCount: number,
  ) {
    super();
    this.addChild(this.gradient);
    for (let i = 0; i < moteCount; i += 1) {
      const sprite = new Sprite({ texture: glowTexture, anchor: 0.5 });
      sprite.scale.set(0.08 + Math.random() * 0.22);
      sprite.blendMode = 'add';
      this.motes.push({
        sprite,
        speed: 8 + Math.random() * 30,
        phase: Math.random() * Math.PI * 2,
      });
      this.addChild(sprite);
    }
    Ticker.shared.add(this.update, this);
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.redraw();
  }

  resize(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
    this.motes.forEach(({ sprite }) => {
      sprite.x = Math.random() * width;
      sprite.y = Math.random() * height;
    });
    this.redraw();
  }

  private redraw(): void {
    const { top, bottom, tint } = THEMES[this.theme];
    const fill = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: top },
        { offset: 1, color: bottom },
      ],
    });
    this.gradient.clear().rect(0, 0, this.viewWidth, this.viewHeight).fill(fill);
    this.motes.forEach(({ sprite }) => (sprite.tint = tint));
  }

  private update(ticker: Ticker): void {
    const dt = ticker.deltaMS / 1000;
    this.time += dt;
    for (const mote of this.motes) {
      mote.sprite.y -= mote.speed * dt;
      mote.sprite.alpha = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(this.time * 1.5 + mote.phase));
      if (mote.sprite.y < -20) {
        mote.sprite.y = this.viewHeight + 20;
        mote.sprite.x = Math.random() * this.viewWidth;
      }
    }
  }

  override destroy(): void {
    Ticker.shared.remove(this.update, this);
    super.destroy({ children: true });
  }
}
