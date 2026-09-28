import { Container, Graphics, Text } from 'pixi.js';
import { Ease, tween, type TweenHandle } from '../core/tween';
import { DISPLAY_FONT } from './art/fonts';

/**
 * Payout label drawn on top of the win lines. Pops in with a small overshoot
 * so the eye is drawn to the number that matters most.
 */
export class WinBadge extends Container {
  private readonly background = new Graphics();
  private readonly amountText: Text;
  private pop: TweenHandle | null = null;

  constructor(private readonly fontSize: number) {
    super();
    this.amountText = new Text({
      text: '',
      anchor: 0.5,
      style: {
        fontFamily: [DISPLAY_FONT, 'Georgia', 'serif'],
        fontWeight: '900',
        fontSize,
        fill: '#fff6c9',
        stroke: { color: '#2a1200', width: Math.max(3, fontSize / 8), join: 'round' },
      },
    });
    this.addChild(this.background, this.amountText);
    this.visible = false;
    this.eventMode = 'none';
  }

  show(text: string, x: number, y: number, borderColor: number): void {
    this.amountText.text = text;
    const paddingX = this.fontSize * 0.7;
    const paddingY = this.fontSize * 0.3;
    const width = this.amountText.width + paddingX * 2;
    const height = this.amountText.height + paddingY * 2;
    this.background
      .clear()
      .roundRect(-width / 2, -height / 2, width, height, height / 2)
      .fill({ color: 0x120826, alpha: 0.88 })
      .stroke({ color: borderColor, width: 3, alpha: 1 });

    this.position.set(x, y);
    this.visible = true;
    this.pop?.cancel();
    this.scale.set(0.6);
    this.pop = tween(this.scale, { x: 1, y: 1 }, { duration: 260, ease: Ease.backOut });
  }

  hide(): void {
    this.pop?.cancel();
    this.visible = false;
  }
}
