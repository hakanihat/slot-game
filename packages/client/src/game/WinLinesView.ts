import { Container, Graphics } from 'pixi.js';
import { PAYLINE_COLORS } from '../config/presentation';

/** Draws paylines through cell centres, with a soft glow pass underneath. */
export class WinLinesView extends Container {
  private readonly graphics = new Graphics();

  constructor(
    private readonly paylines: readonly (readonly number[])[],
    private readonly cellSize: number,
  ) {
    super();
    this.addChild(this.graphics);
  }

  show(lineIndices: readonly number[]): void {
    this.graphics.clear();
    for (const index of lineIndices) this.drawLine(index);
  }

  clear(): void {
    this.graphics.clear();
  }

  private drawLine(index: number): void {
    const rows = this.paylines[index];
    if (!rows) return;
    const color = lineColor(index);
    const half = this.cellSize / 2;
    const points = rows.map((row, reel) => ({
      x: reel * this.cellSize + half,
      y: row * this.cellSize + half,
    }));
    // Extend slightly beyond the first and last reel so the line reads as "through" the grid.
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) return;

    const trace = () => {
      this.graphics.moveTo(first.x - half * 0.9, first.y);
      points.forEach((p) => this.graphics.lineTo(p.x, p.y));
      this.graphics.lineTo(last.x + half * 0.9, last.y);
    };

    trace();
    this.graphics.stroke({ color, width: 16, alpha: 0.22, join: 'round', cap: 'round' });
    trace();
    this.graphics.stroke({ color, width: 6, alpha: 0.95, join: 'round', cap: 'round' });
    trace();
    this.graphics.stroke({ color: 0xffffff, width: 2, alpha: 0.7, join: 'round', cap: 'round' });
  }
}

export const lineColor = (lineIndex: number): number =>
  PAYLINE_COLORS[lineIndex % PAYLINE_COLORS.length] ?? 0xffffff;
