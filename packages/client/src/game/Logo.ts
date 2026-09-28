import { Container, FillGradient } from 'pixi.js';
import { DISPLAY_FONT } from './art/symbolArt';
import { GlowText } from './GlowText';

/** Game title lockup above the reels. */
export class Logo extends Container {
  constructor(title: string) {
    super();
    const fill = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: '#ffffff' },
        { offset: 0.45, color: '#ffe27a' },
        { offset: 1, color: '#d98a00' },
      ],
    });
    const text = new GlowText(
      title.toUpperCase(),
      {
        fontFamily: [DISPLAY_FONT, 'Georgia', 'serif'],
        fontWeight: '900',
        fontSize: 64,
        letterSpacing: 6,
        fill,
        stroke: { color: '#3a1600', width: 8, join: 'round' },
      },
      '#ff9d00',
    );
    this.addChild(text);
  }
}
