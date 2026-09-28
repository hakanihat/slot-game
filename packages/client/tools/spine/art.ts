import { DISPLAY_FONT } from '../../src/game/art/fonts';

/**
 * Procedural artwork for the Spine symbol rig (Canvas 2D, build-time only).
 *
 * Every function draws ONE rig part centred on the context origin, so the
 * generator can bake each part into its own atlas region: gem bodies, labels,
 * and the shared FX layers (glow, shine, sparkle, rays) that the animations
 * move independently.
 */

export type Point = readonly [number, number];

export interface Palette {
  readonly light: string;
  readonly mid: string;
  readonly dark: string;
  readonly glow: string;
}

export { DISPLAY_FONT };
const FONT_STACK = `"${DISPLAY_FONT}", Georgia, "Times New Roman", serif`;

export const PALETTES = {
  RUBY: { light: '#ffb3c0', mid: '#e3143f', dark: '#5c0016', glow: '#ff2a55' },
  SAPPHIRE: { light: '#b5ddff', mid: '#1f6fe8', dark: '#081a5c', glow: '#3a8dff' },
  EMERALD: { light: '#b6ffd6', mid: '#12b35a', dark: '#033f21', glow: '#2aff8a' },
  AMETHYST: { light: '#ecd0ff', mid: '#9b3ce0', dark: '#360a60', glow: '#b85cff' },
  SCATTER: { light: '#ffe0f6', mid: '#ff3fb4', dark: '#6a0046', glow: '#ff5ccf' },
  WILD: { light: '#fff6c2', mid: '#ffbf1f', dark: '#7a4200', glow: '#ffd24a' },
} as const satisfies Record<string, Palette>;

export type RoyalId = 'J' | 'Q' | 'K' | 'A';
export type GemId = 'RUBY' | 'SAPPHIRE' | 'EMERALD' | 'AMETHYST';

export const ROYAL_COLORS: Readonly<Record<RoyalId, string>> = {
  J: '#45f0c0',
  Q: '#ff5ca8',
  K: '#ffa53a',
  A: '#5cb8ff',
};

/** Regular polygon with `n` vertices on an ellipse, rotated by `rotation` radians. */
const polygon = (n: number, rx: number, ry: number, rotation = -Math.PI / 2): Point[] =>
  Array.from({ length: n }, (_, i) => {
    const a = rotation + (i / n) * Math.PI * 2;
    return [Math.cos(a) * rx, Math.sin(a) * ry] as const;
  });

const star = (points: number, outer: number, inner: number): Point[] =>
  Array.from({ length: points * 2 }, (_, i) => {
    const a = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? outer : inner;
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  });

/**
 * Outlines in a unit box (-1..1, canvas y-down). Each gem has a distinct cut so
 * shape alone identifies it; the same outlines become the Spine clipping
 * polygons that keep the shine sweep inside the gem.
 */
export const OUTLINES: Readonly<Record<GemId | 'WILD' | 'SCATTER', Point[]>> = {
  RUBY: polygon(8, 0.92, 0.92, -Math.PI / 2 + Math.PI / 8),
  SAPPHIRE: polygon(6, 0.88, 0.98),
  EMERALD: [
    [-0.45, -0.95],
    [0.45, -0.95],
    [0.72, -0.68],
    [0.72, 0.68],
    [0.45, 0.95],
    [-0.45, 0.95],
    [-0.72, 0.68],
    [-0.72, -0.68],
  ],
  AMETHYST: [
    [0, -0.98],
    [0.18, -0.88],
    [0.95, 0.6],
    [0.88, 0.8],
    [-0.88, 0.8],
    [-0.95, 0.6],
    [-0.18, -0.88],
  ],
  WILD: polygon(8, 1, 1, -Math.PI / 2),
  SCATTER: star(5, 1.05, 0.5),
};

/** Inner "table" size per outline — smaller tables read as deeper cuts. */
export const TABLE_SCALE: Readonly<Record<keyof typeof OUTLINES, number>> = {
  RUBY: 0.52,
  SAPPHIRE: 0.52,
  EMERALD: 0.52,
  AMETHYST: 0.52,
  WILD: 0.6,
  SCATTER: 0.45,
};

/** Light comes from the top-left, like most slot art, so facets read consistently. */
const LIGHT_DIRECTION = Math.atan2(-1, -1);

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) =>
    Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

function tracePath(ctx: CanvasRenderingContext2D, points: readonly Point[], scale: number): void {
  ctx.beginPath();
  points.forEach(([x, y], i) =>
    i === 0 ? ctx.moveTo(x * scale, y * scale) : ctx.lineTo(x * scale, y * scale),
  );
  ctx.closePath();
}

/**
 * Faceted gem body: crown facets between the outline and an inner "table",
 * each shaded by how much it faces the light.
 */
export function drawFacetedGem(
  ctx: CanvasRenderingContext2D,
  outline: readonly Point[],
  palette: Palette,
  radius: number,
  tableScale: number,
): void {
  const table = outline.map(([x, y]) => [x * tableScale, y * tableScale - 0.04] as const);

  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = radius * 0.28;
  tracePath(ctx, outline, radius);
  ctx.fillStyle = palette.dark;
  ctx.fill();
  ctx.restore();

  outline.forEach((point, i) => {
    const next = outline[(i + 1) % outline.length] as Point;
    const tablePoint = table[i] as Point;
    const tableNext = table[(i + 1) % table.length] as Point;
    const angle = Math.atan2((point[1] + next[1]) / 2, (point[0] + next[0]) / 2);
    const lit = (Math.cos(angle - LIGHT_DIRECTION) + 1) / 2;
    ctx.beginPath();
    ctx.moveTo(point[0] * radius, point[1] * radius);
    ctx.lineTo(next[0] * radius, next[1] * radius);
    ctx.lineTo(tableNext[0] * radius, tableNext[1] * radius);
    ctx.lineTo(tablePoint[0] * radius, tablePoint[1] * radius);
    ctx.closePath();
    ctx.fillStyle =
      lit > 0.5
        ? mix(palette.mid, palette.light, (lit - 0.5) * 1.6)
        : mix(palette.dark, palette.mid, lit * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = radius * 0.015;
    ctx.stroke();
  });

  tracePath(ctx, table, radius);
  const gradient = ctx.createLinearGradient(
    -radius * 0.5,
    -radius * 0.6,
    radius * 0.5,
    radius * 0.5,
  );
  gradient.addColorStop(0, palette.light);
  gradient.addColorStop(0.55, palette.mid);
  gradient.addColorStop(1, palette.dark);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = radius * 0.02;
  ctx.stroke();

  tracePath(ctx, outline, radius);
  ctx.strokeStyle = mix(palette.light, palette.mid, 0.3);
  ctx.lineWidth = radius * 0.035;
  ctx.stroke();
}

/** Letter royals (J, Q, K, A) with a gradient fill and coloured glow. */
export function drawRoyal(ctx: CanvasRenderingContext2D, letter: RoyalId, radius: number): void {
  const color = ROYAL_COLORS[letter];
  const size = radius * 1.45;
  ctx.save();
  ctx.font = `900 ${size}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  // Fit and centre on the glyph's *ink*, not its advance box: some letters
  // (Cinzel's swash Q) extend far beyond their advance width.
  const metrics = ctx.measureText(letter);
  const inkWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
  const fit = Math.min(1, (radius * 1.9) / inkWidth);
  ctx.scale(fit, fit);
  ctx.translate((metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) / 2, 0);

  ctx.shadowColor = color;
  ctx.shadowBlur = radius * 0.3;
  ctx.lineWidth = radius * 0.12;
  ctx.strokeStyle = mix(color, '#000000', 0.7);
  ctx.strokeText(letter, 0, radius * 0.06);

  ctx.shadowBlur = 0;
  const gradient = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.35, mix(color, '#ffffff', 0.35));
  gradient.addColorStop(0.7, color);
  gradient.addColorStop(1, mix(color, '#000000', 0.45));
  ctx.fillStyle = gradient;
  ctx.fillText(letter, 0, radius * 0.06);

  ctx.lineWidth = radius * 0.025;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.strokeText(letter, 0, radius * 0.06);
  ctx.restore();
}

/** Banner text (WILD / BONUS), drawn as its own part so it can bounce. */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  palette: Palette,
): void {
  ctx.save();
  ctx.font = `900 ${size}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.22;
  ctx.strokeStyle = palette.dark;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = size * 0.2;
  ctx.strokeText(text, 0, 0);
  ctx.shadowBlur = 0;
  const gradient = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.45, palette.light);
  gradient.addColorStop(1, palette.mid);
  ctx.fillStyle = gradient;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// ── Shared FX parts (white, tinted per skin in Spine) ─────────────────

/** Four-point twinkle. */
export function drawSparkle(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = size * 0.8;
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? size : size * 0.18;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Soft radial glow. */
export function drawGlow(ctx: CanvasRenderingContext2D, radius: number): void {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
}

/** Vertical light band with feathered edges, swept across gems on win. */
export function drawShine(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const g = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-width / 2, -height / 2, width, height);
}

/**
 * Starburst behind Wild / Scatter. 12 rays → 30° symmetry, so a 30° rotation
 * loops seamlessly.
 */
export const RAY_COUNT = 12;

export function drawRays(ctx: CanvasRenderingContext2D, radius: number): void {
  const g = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  const half = (Math.PI / RAY_COUNT) * 0.45;
  for (let i = 0; i < RAY_COUNT; i += 1) {
    const a = (i / RAY_COUNT) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, a - half, a + half);
    ctx.closePath();
    ctx.fill();
  }
}
