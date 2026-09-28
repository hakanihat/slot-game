import { BlurFilter, Container, Text, type TextStyleOptions } from 'pixi.js';

/**
 * Text with a soft coloured halo: a blurred, tinted copy sits behind the crisp
 * text. More robust across GPUs than the text drop-shadow, and the glow
 * strength can be animated independently.
 */
export class GlowText extends Container {
  private readonly main: Text;
  private readonly halo: Text;

  constructor(text: string, style: TextStyleOptions, glowColor: string, glowStrength = 14) {
    super();
    this.halo = new Text({
      text,
      style: { ...style, fill: glowColor, stroke: { color: glowColor, width: 10, join: 'round' } },
      anchor: 0.5,
    });
    this.halo.filters = [new BlurFilter({ strength: glowStrength, quality: 3 })];
    this.halo.alpha = 0.75;
    this.main = new Text({ text, style, anchor: 0.5 });
    this.addChild(this.halo, this.main);
  }

  get text(): string {
    return this.main.text;
  }

  set text(value: string) {
    if (value === this.main.text) return;
    this.main.text = value;
    this.halo.text = value;
  }
}
