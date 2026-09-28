import { Container, Graphics } from 'pixi.js';
import { Ease, tween } from '../../core/tween';

/**
 * Base for full-screen, tap-to-continue overlays: a dimmed backdrop that
 * captures input, centred content, and fade in/out helpers.
 */
export abstract class Overlay extends Container {
  protected readonly backdrop = new Graphics();
  protected readonly content = new Container();
  protected viewWidth = 1;
  protected viewHeight = 1;
  private tapListeners: (() => void)[] = [];

  constructor() {
    super();
    this.visible = false;
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', () => this.notifyTap());
    this.addChild(this.backdrop, this.content);
  }

  resize(width: number, height: number, scale: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
    this.backdrop.clear().rect(0, 0, width, height).fill({ color: 0x05020f, alpha: 0.72 });
    this.content.position.set(width / 2, height / 2);
    this.content.scale.set(scale);
  }

  /** Lets keyboard input (Space/Enter) act like a tap. */
  notifyTap(): void {
    const listeners = this.tapListeners;
    this.tapListeners = [];
    listeners.forEach((listener) => listener());
  }

  protected nextTap(): Promise<void> {
    return new Promise((resolve) => this.tapListeners.push(resolve));
  }

  protected async fadeIn(): Promise<void> {
    this.visible = true;
    this.alpha = 0;
    this.content.scale.set(this.content.scale.x * 0.8);
    const target = this.content.scale.x / 0.8;
    await Promise.all([
      tween(this as Container, { alpha: 1 }, { duration: 220 }).finished,
      tween(this.content.scale, { x: target, y: target }, { duration: 380, ease: Ease.backOut })
        .finished,
    ]);
  }

  protected async fadeOut(): Promise<void> {
    // Taps that were raced against a timeout and never came are no longer wanted.
    this.tapListeners = [];
    await tween(this as Container, { alpha: 0 }, { duration: 220 }).finished;
    this.visible = false;
  }
}
