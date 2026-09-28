import { Container, Sprite, Ticker, type Texture } from 'pixi.js';

interface Coin {
  readonly sprite: Sprite;
  vx: number;
  vy: number;
  spin: number;
}

const GRAVITY = 1400;

/** Lightweight particle fountain — pooled sprites, no allocations per frame. */
export class CoinShower extends Container {
  private readonly coins: Coin[] = [];
  private emitting = false;
  private emitAccumulator = 0;
  private viewWidth = 0;
  private viewHeight = 0;

  constructor(
    private readonly texture: Texture,
    private readonly rate: number,
  ) {
    super();
    Ticker.shared.add(this.update, this);
  }

  resize(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
  }

  start(): void {
    this.emitting = true;
  }

  stop(): void {
    this.emitting = false;
  }

  clear(): void {
    this.coins.forEach((coin) => (coin.sprite.visible = false));
  }

  private spawn(): void {
    let coin = this.coins.find((c) => !c.sprite.visible);
    if (!coin) {
      const sprite = new Sprite({ texture: this.texture, anchor: 0.5 });
      coin = { sprite, vx: 0, vy: 0, spin: 0 };
      this.coins.push(coin);
      this.addChild(sprite);
    }
    coin.sprite.visible = true;
    coin.sprite.x = this.viewWidth / 2 + (Math.random() - 0.5) * this.viewWidth * 0.3;
    coin.sprite.y = this.viewHeight + 30;
    coin.sprite.scale.set(0.35 + Math.random() * 0.35);
    coin.vx = (Math.random() - 0.5) * this.viewWidth * 0.9;
    coin.vy = -(this.viewHeight * 1.3 + Math.random() * this.viewHeight * 0.6);
    coin.spin = (Math.random() - 0.5) * 12;
  }

  private update(ticker: Ticker): void {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
    if (this.emitting) {
      this.emitAccumulator += dt * this.rate;
      while (this.emitAccumulator >= 1) {
        this.emitAccumulator -= 1;
        this.spawn();
      }
    }
    for (const coin of this.coins) {
      if (!coin.sprite.visible) continue;
      coin.vy += GRAVITY * dt;
      coin.sprite.x += coin.vx * dt;
      coin.sprite.y += coin.vy * dt;
      coin.sprite.rotation += coin.spin * dt;
      // Fake 3D flip by squashing on X.
      coin.sprite.scale.x = coin.sprite.scale.y * Math.cos(coin.sprite.rotation * 2);
      if (coin.sprite.y > this.viewHeight + 60 && coin.vy > 0) coin.sprite.visible = false;
    }
  }

  override destroy(): void {
    Ticker.shared.remove(this.update, this);
    super.destroy({ children: true });
  }
}
