/**
 * Generates the Spine assets for the reel symbols:
 *
 *   public/spine/symbols.json   skeleton (bones, slots, skins, animations)
 *   public/spine/symbols.atlas  texture atlas description
 *   public/spine/symbols.png    packed texture page
 *
 * These files are exactly what the Spine Editor exports, so an artist can
 * replace them with hand-animated versions without touching game code.
 *
 *   npm run spine:build
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { DISPLAY_FONT } from './art';
import { atlasText, packShelves } from './atlas';
import { buildSkeleton, REGIONS } from './rig';

const OUT_DIR = fileURLToPath(new URL('../../public/spine/', import.meta.url));
const FONT = fileURLToPath(new URL('./fonts/Cinzel-Black.ttf', import.meta.url));
const NAME = 'symbols';
const PAGE_WIDTH = 1024;
const PADDING = 2;

if (!GlobalFonts.registerFromPath(FONT, DISPLAY_FONT)) {
  throw new Error(`Could not register font ${FONT}`);
}

const pack = packShelves(REGIONS, PAGE_WIDTH, PADDING);
const page = createCanvas(pack.width, pack.height);
const pageCtx = page.getContext('2d');

for (const region of pack.regions) {
  const spec = REGIONS.find((r) => r.name === region.name);
  if (!spec) continue;
  const canvas = createCanvas(spec.width, spec.height);
  const ctx = canvas.getContext('2d');
  ctx.translate(spec.width / 2, spec.height / 2);
  // @napi-rs/canvas implements the standard 2D API; the art is typed against the DOM one.
  spec.draw(ctx as unknown as CanvasRenderingContext2D);
  pageCtx.drawImage(canvas, region.x, region.y);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}${NAME}.png`, page.toBuffer('image/png'));
writeFileSync(`${OUT_DIR}${NAME}.atlas`, atlasText(`${NAME}.png`, pack));
writeFileSync(`${OUT_DIR}${NAME}.json`, `${JSON.stringify(buildSkeleton(), null, 1)}\n`);

console.info(
  `Spine assets written to ${OUT_DIR}: ${pack.regions.length} regions on a ${pack.width}x${pack.height} page`,
);
