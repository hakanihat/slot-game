import type { SymbolId } from '@gem-rush/shared';

/**
 * Procedural symbol artwork (Canvas 2D). Drawing in code keeps the repo free
 * of binary assets, makes every symbol resolution-independent, and gives the
 * reels and the HUD paytable one shared source of truth.
 */

export const DISPLAY_FONT = 'Cinzel';
const FONT_STACK = `"${DISPLAY_FONT}", Georgia, "Times New Roman", serif`;

interface Palette {
  readonly light: string;
  readonly mid: string;
  readonly dark: string;
  readonly glow: string;
}

type Point = readonly [number, number];

const GEM_PALETTES = {
  RUBY: { light: '#ffb3c0', mid: '#e3143f', dark: '#5c0016', glow: '#ff2a55' },
  SAPPHIRE: { light: '#b5ddff', mid: '#1f6fe8', dark: '#081a5c', glow: '#3a8dff' },
  EMERALD: { light: '#b6ffd6', mid: '#12b35a', dark: '#033f21', glow: '#2aff8a' },
  AMETHYST: { light: '#ecd0ff', mid: '#9b3ce0', dark: '#360a60', glow: '#b85cff' },
  SCATTER: { light: '#ffe0f6', mid: '#ff3fb4', dark: '#6a0046', glow: '#ff5ccf' },
  WILD: { light: '#fff6c2', mid: '#ffbf1f', dark: '#7a4200', glow: '#ffd24a' },
} as const satisfies Record<string, Palette>;

const ROYAL_COLORS: Readonly<Record<'J' | 'Q' | 'K' | 'A', string>> = {
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

/** Gem outlines in a unit box (-1..1). Each gem gets a distinct cut so shape alone identifies it. */
const GEM_SHAPES: Readonly<Record<'RUBY' | 'SAPPHIRE' | 'EMERALD' | 'AMETHYST', Point[]>> = {
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
 * Draws a faceted gem: the crown facets between the outline and an inner
 * "table" are shaded by how much each faces the light.
 */
function drawFacetedGem(
  ctx: CanvasRenderingContext2D,
  outline: readonly Point[],
  palette: Palette,
  radius: number,
  tableScale = 0.52,
): void {
  const table = outline.map(([x, y]) => [x * tableScale, y * tableScale - 0.04] as const);

  // Glow + base silhouette.
  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = radius * 0.28;
  tracePath(ctx, outline, radius);
  ctx.fillStyle = palette.dark;
  ctx.fill();
  ctx.restore();

  // Crown facets.
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

  // Table with a soft top-left highlight.
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

  // Outline rim.
  tracePath(ctx, outline, radius);
  ctx.strokeStyle = mix(palette.light, palette.mid, 0.3);
  ctx.lineWidth = radius * 0.035;
  ctx.stroke();

  drawSparkle(ctx, -radius * 0.28, -radius * 0.36, radius * 0.2);
}

function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
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

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
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
  ctx.strokeText(text, 0, y);
  ctx.shadowBlur = 0;
  const gradient = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.45, palette.light);
  gradient.addColorStop(1, palette.mid);
  ctx.fillStyle = gradient;
  ctx.fillText(text, 0, y);
  ctx.restore();
}

function drawRoyal(
  ctx: CanvasRenderingContext2D,
  letter: 'J' | 'Q' | 'K' | 'A',
  radius: number,
): void {
  const color = ROYAL_COLORS[letter];
  const size = radius * 1.45;
  ctx.save();
  ctx.font = `900 ${size}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

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

/** Renders one symbol onto a new square canvas of `size` pixels. */
export function renderSymbol(id: SymbolId, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported');

  ctx.translate(size / 2, size / 2);
  const radius = size * 0.4;

  switch (id) {
    case 'J':
    case 'Q':
    case 'K':
    case 'A':
      drawRoyal(ctx, id, radius);
      break;
    case 'RUBY':
    case 'SAPPHIRE':
    case 'EMERALD':
    case 'AMETHYST':
      drawFacetedGem(ctx, GEM_SHAPES[id], GEM_PALETTES[id], radius);
      break;
    case 'WILD':
      drawFacetedGem(ctx, polygon(8, 1, 1, -Math.PI / 2), GEM_PALETTES.WILD, radius, 0.6);
      drawLabel(ctx, 'WILD', radius * 0.12, radius * 0.62, GEM_PALETTES.WILD);
      break;
    case 'SCATTER':
      drawFacetedGem(ctx, star(5, 1.05, 0.5), GEM_PALETTES.SCATTER, radius, 0.45);
      drawLabel(ctx, 'BONUS', radius * 0.78, radius * 0.4, GEM_PALETTES.SCATTER);
      break;
  }
  return canvas;
}

/** Waits for the display font so canvas text never renders in a fallback face. */
export async function loadArtFonts(): Promise<void> {
  try {
    await Promise.race([
      document.fonts.load(`900 64px "${DISPLAY_FONT}"`),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    // Fall back to the serif stack.
  }
}
