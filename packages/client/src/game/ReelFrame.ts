import { Container, FillGradient, Graphics } from 'pixi.js';

/** Decorative frame behind the reels: backplate, gold rim and column separators. */
export class ReelFrame extends Container {
  constructor(width: number, height: number, columns: number, padding: number) {
    super();
    const outer = { x: -padding, y: -padding, w: width + padding * 2, h: height + padding * 2 };

    const rim = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: '#fff1a8' },
        { offset: 0.45, color: '#d99a1e' },
        { offset: 1, color: '#6b3c00' },
      ],
    });

    const glow = new Graphics()
      .roundRect(outer.x - 10, outer.y - 10, outer.w + 20, outer.h + 20, 34)
      .fill({ color: 0x7a4bff, alpha: 0.18 });

    const plate = new Graphics()
      .roundRect(outer.x, outer.y, outer.w, outer.h, 26)
      .fill(rim)
      .roundRect(outer.x + 6, outer.y + 6, outer.w - 12, outer.h - 12, 22)
      .fill({ color: 0x0b0620 });

    const window = new Graphics()
      .roundRect(-4, -4, width + 8, height + 8, 14)
      .fill({ color: 0x140a33 });
    const columnWidth = width / columns;
    for (let c = 0; c < columns; c += 1) {
      window
        .rect(c * columnWidth + 3, 0, columnWidth - 6, height)
        .fill({ color: c % 2 === 0 ? 0x1d1147 : 0x190e3e });
    }

    this.addChild(glow, plate, window);
  }
}
