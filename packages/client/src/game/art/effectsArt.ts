import { Texture } from 'pixi.js';

function canvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported');
  draw(ctx, size);
  return Texture.from(canvas);
}

/** Soft radial dot used for ambient sparkles. */
export const createGlowTexture = (): Texture =>
  canvasTexture(64, (ctx, size) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });

/** Gold coin for win celebrations. */
export const createCoinTexture = (): Texture =>
  canvasTexture(96, (ctx, size) => {
    const r = size * 0.44;
    ctx.translate(size / 2, size / 2);
    const rim = ctx.createLinearGradient(-r, -r, r, r);
    rim.addColorStop(0, '#fff3b0');
    rim.addColorStop(0.5, '#e6a100');
    rim.addColorStop(1, '#7a4a00');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    const face = ctx.createLinearGradient(-r, -r, r, r);
    face.addColorStop(0, '#ffe680');
    face.addColorStop(1, '#c98200');
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6c9';
    ctx.font = `900 ${r}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('€', 0, r * 0.05);
  });
