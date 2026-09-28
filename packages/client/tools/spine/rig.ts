import { SYMBOL_IDS, type SymbolId } from '@gem-rush/shared';
import {
  OUTLINES,
  PALETTES,
  RAY_COUNT,
  ROYAL_COLORS,
  TABLE_SCALE,
  drawFacetedGem,
  drawGlow,
  drawLabel,
  drawRays,
  drawRoyal,
  drawShine,
  drawSparkle,
  type RoyalId,
} from './art';
import {
  SYMBOL_ANIMATIONS,
  SYMBOL_UNIT_SIZE,
  type SymbolAnimation,
} from '../../src/game/spine/symbolAssets';

/**
 * The Gem Rush symbol rig: one skeleton, one skin per symbol, shared
 * animations. Units are Spine world units (== atlas pixels at scale 1);
 * Spine is y-UP, the canvas art is y-DOWN, hence the `-y` conversions.
 */

export const BODY_SIZE = SYMBOL_UNIT_SIZE;
export const RADIUS = BODY_SIZE * 0.4;

// ── Atlas regions ─────────────────────────────────────────────────────

export interface RegionSpec {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** Draws the part centred on the origin. */
  readonly draw: (ctx: CanvasRenderingContext2D) => void;
}

const ROYALS: readonly RoyalId[] = ['J', 'Q', 'K', 'A'];
const isRoyal = (id: SymbolId): id is RoyalId => (ROYALS as readonly string[]).includes(id);
const hasOutline = (id: SymbolId): id is keyof typeof OUTLINES => id in OUTLINES;

function bodyRegion(id: SymbolId): RegionSpec {
  return {
    name: `${id}/body`,
    width: BODY_SIZE,
    height: BODY_SIZE,
    draw: (ctx) => {
      if (isRoyal(id)) drawRoyal(ctx, id, RADIUS);
      else if (hasOutline(id))
        drawFacetedGem(ctx, OUTLINES[id], PALETTES[id], RADIUS, TABLE_SCALE[id]);
    },
  };
}

export const REGIONS: readonly RegionSpec[] = [
  ...SYMBOL_IDS.map(bodyRegion),
  {
    name: 'WILD/label',
    width: 300,
    height: 120,
    draw: (ctx) => drawLabel(ctx, 'WILD', RADIUS * 0.62, PALETTES.WILD),
  },
  {
    name: 'SCATTER/label',
    width: 240,
    height: 84,
    draw: (ctx) => drawLabel(ctx, 'BONUS', RADIUS * 0.4, PALETTES.SCATTER),
  },
  { name: 'fx/glow', width: 256, height: 256, draw: (ctx) => drawGlow(ctx, 128) },
  { name: 'fx/shine', width: 56, height: 300, draw: (ctx) => drawShine(ctx, 56, 300) },
  { name: 'fx/sparkle', width: 80, height: 80, draw: (ctx) => drawSparkle(ctx, RADIUS * 0.2) },
  { name: 'fx/rays', width: 320, height: 320, draw: (ctx) => drawRays(ctx, 160) },
];

// ── Skeleton ──────────────────────────────────────────────────────────

/** Canvas (y-down, unit) → Spine (y-up, world units). */
const toSpine = ([x, y]: readonly [number, number], scale = RADIUS): [number, number] => [
  round(x * scale),
  round(-y * scale),
];
const round = (n: number) => Math.round(n * 100) / 100;

const SPARKLE_1 = toSpine([-0.28, -0.36]);
const SPARKLE_2 = toSpine([0.34, 0.3]);
const SHINE_START_X = -150;
const SHINE_END_X = 150;

const LABEL_Y: Partial<Record<SymbolId, number>> = {
  WILD: -RADIUS * 0.12,
  SCATTER: -RADIUS * 0.78,
};
const RAY_COLOR: Partial<Record<SymbolId, string>> = { WILD: 'ffd24aff', SCATTER: 'ff5ccfff' };

const hex = (css: string) => `${css.replace('#', '')}ff`;
const glowColor = (id: SymbolId): string =>
  isRoyal(id) ? hex(ROYAL_COLORS[id]) : hex(PALETTES[id as keyof typeof PALETTES].glow);

const BONES = [
  { name: 'root' },
  { name: 'symbol', parent: 'root' },
  { name: 'rays', parent: 'symbol' },
  { name: 'glow', parent: 'symbol' },
  { name: 'body', parent: 'symbol' },
  { name: 'shine', parent: 'symbol', x: SHINE_START_X },
  { name: 'label', parent: 'symbol' },
  { name: 'sparkle1', parent: 'symbol', x: SPARKLE_1[0], y: SPARKLE_1[1] },
  { name: 'sparkle2', parent: 'symbol', x: SPARKLE_2[0], y: SPARKLE_2[1] },
];

/** Draw order, back to front. `clip` masks everything up to and including `shine`. */
const SLOTS = [
  { name: 'rays', bone: 'rays', attachment: 'rays', color: 'ffffff00', blend: 'additive' },
  { name: 'glow', bone: 'glow', attachment: 'glow', color: 'ffffff00', blend: 'additive' },
  { name: 'body', bone: 'body', attachment: 'body' },
  { name: 'clip', bone: 'body', attachment: 'clip' },
  { name: 'shine', bone: 'shine', attachment: 'shine', blend: 'additive' },
  { name: 'label', bone: 'label', attachment: 'label' },
  { name: 'sparkle1', bone: 'sparkle1', attachment: 'sparkle', blend: 'additive' },
  {
    name: 'sparkle2',
    bone: 'sparkle2',
    attachment: 'sparkle',
    color: 'ffffff00',
    blend: 'additive',
  },
];

type Attachment = Record<string, unknown>;

function skinFor(id: SymbolId) {
  const region = (
    path: string,
    width: number,
    height: number,
    extra: Attachment = {},
  ): Attachment => ({
    path,
    width,
    height,
    ...extra,
  });
  const attachments: Record<string, Record<string, Attachment>> = {
    body: { body: region(`${id}/body`, BODY_SIZE, BODY_SIZE) },
    glow: {
      glow: region('fx/glow', 256, 256, { scaleX: 1.35, scaleY: 1.35, color: glowColor(id) }),
    },
    sparkle2: { sparkle: region('fx/sparkle', 80, 80) },
  };

  if (hasOutline(id)) {
    const outline = OUTLINES[id].map((p) => toSpine(p)).flat();
    attachments.clip = {
      clip: { type: 'clipping', end: 'shine', vertexCount: OUTLINES[id].length, vertices: outline },
    };
    attachments.shine = { shine: region('fx/shine', 56, 300, { rotation: -20 }) };
    attachments.sparkle1 = { sparkle: region('fx/sparkle', 80, 80) };
  }

  const labelY = LABEL_Y[id];
  if (labelY !== undefined) {
    const size = id === 'WILD' ? [300, 120] : [240, 84];
    attachments.label = {
      label: region(`${id}/label`, size[0] ?? 0, size[1] ?? 0, { y: round(labelY) }),
    };
  }
  const rayColor = RAY_COLOR[id];
  if (rayColor)
    attachments.rays = {
      rays: region('fx/rays', 320, 320, { scaleX: 1.2, scaleY: 1.2, color: rayColor }),
    };

  return { name: id, attachments };
}

// ── Animation curves ──────────────────────────────────────────────────

type Ease = 'linear' | 'stepped' | readonly [number, number, number, number];

/** CSS-style cubic-bezier presets. */
export const EASE = {
  linear: 'linear',
  out: [0.22, 1, 0.36, 1],
  in: [0.55, 0, 1, 0.45],
  inOut: [0.65, 0, 0.35, 1],
  back: [0.34, 1.56, 0.64, 1],
} as const satisfies Record<string, Ease>;

interface Key<V> {
  readonly t: number;
  readonly v: V;
  /** Easing of the segment that starts at this key. */
  readonly ease?: Ease;
}

/**
 * Spine stores Bézier handles in absolute (time, value) space, one set of
 * four numbers per animated property. This converts normalised CSS-style
 * easings into that representation.
 */
function curveFor(
  ease: Ease,
  t1: number,
  t2: number,
  from: readonly number[],
  to: readonly number[],
) {
  if (ease === 'linear') return undefined;
  if (ease === 'stepped') return 'stepped';
  const [x1, y1, x2, y2] = ease;
  return from.flatMap((v1, i) => {
    const v2 = to[i] ?? v1;
    return [
      round(t1 + x1 * (t2 - t1)),
      round(v1 + y1 * (v2 - v1)),
      round(t1 + x2 * (t2 - t1)),
      round(v1 + y2 * (v2 - v1)),
    ];
  });
}

function frames<V>(
  keys: readonly Key<V>[],
  encode: (v: V) => Attachment,
  values: (v: V) => number[],
) {
  return keys.map((key, i) => {
    const next = keys[i + 1];
    const curve = next
      ? curveFor(key.ease ?? EASE.inOut, key.t, next.t, values(key.v), values(next.v))
      : undefined;
    return { time: key.t, ...encode(key.v), ...(curve ? { curve } : {}) };
  });
}

const rotate = (keys: readonly Key<number>[]) =>
  frames(
    keys,
    (v) => ({ value: v }),
    (v) => [v],
  );
const scale = (keys: readonly Key<number>[]) =>
  frames(
    keys,
    (v) => ({ x: v, y: v }),
    (v) => [v, v],
  );
const translate = (keys: readonly Key<[number, number]>[]) =>
  frames(
    keys,
    ([x, y]) => ({ x, y }),
    (v) => v,
  );
/** Alpha-only colour keys on a white slot (0-1 alpha). */
const alpha = (keys: readonly Key<number>[]) =>
  frames(
    keys,
    (a) => ({
      color: `ffffff${Math.round(a * 255)
        .toString(16)
        .padStart(2, '0')}`,
    }),
    (a) => [1, 1, 1, a],
  );

// ── Animations ────────────────────────────────────────────────────────

/** Seconds; the win loop length also sets the rhythm of the win presentation. */
export const WIN_LOOP = 1.2;
const LAND = 0.5;

function animations() {
  return {
    /** Setup pose — what the static reel sprites are baked from. */
    [SYMBOL_ANIMATIONS.idle]: {},

    /** Played once when a Wild or Scatter lands: squash, glow flash, ray burst. */
    [SYMBOL_ANIMATIONS.land]: {
      bones: {
        symbol: {
          scale: scale([
            { t: 0, v: 1.3, ease: EASE.out },
            { t: 0.12, v: 0.92, ease: EASE.inOut },
            { t: 0.24, v: 1.05, ease: EASE.inOut },
            { t: 0.36, v: 1 },
          ]),
        },
        rays: {
          scale: scale([
            { t: 0, v: 0.6, ease: EASE.out },
            { t: LAND, v: 1.3 },
          ]),
          rotate: rotate([
            { t: 0, v: 0, ease: EASE.out },
            { t: LAND, v: -20 },
          ]),
        },
        sparkle1: {
          scale: scale([
            { t: 0, v: 0, ease: EASE.back },
            { t: 0.25, v: 1.3, ease: EASE.inOut },
            { t: LAND, v: 1 },
          ]),
        },
      },
      slots: {
        glow: {
          rgba: alpha([
            { t: 0, v: 1, ease: EASE.in },
            { t: LAND, v: 0 },
          ]),
        },
        rays: {
          rgba: alpha([
            { t: 0, v: 0.9, ease: EASE.in },
            { t: LAND, v: 0 },
          ]),
        },
      },
    },

    /** Looped while a symbol is part of a win: pulse, glow, shine sweep, twinkles, rotating rays. */
    [SYMBOL_ANIMATIONS.win]: {
      bones: {
        symbol: {
          scale: scale([
            { t: 0, v: 1, ease: EASE.out },
            { t: 0.25, v: 1.1, ease: EASE.inOut },
            { t: 0.6, v: 1 },
            { t: WIN_LOOP, v: 1 },
          ]),
        },
        glow: {
          scale: scale([
            { t: 0, v: 0.95, ease: EASE.out },
            { t: 0.3, v: 1.15, ease: EASE.inOut },
            { t: WIN_LOOP, v: 0.95 },
          ]),
        },
        shine: {
          translate: translate([
            { t: 0, v: [0, 0], ease: EASE.inOut },
            { t: 0.55, v: [SHINE_END_X - SHINE_START_X, 0] },
            { t: WIN_LOOP, v: [SHINE_END_X - SHINE_START_X, 0] },
          ]),
        },
        label: {
          scale: scale([
            { t: 0, v: 1, ease: EASE.out },
            { t: 0.15, v: 1.15, ease: EASE.back },
            { t: 0.45, v: 1 },
          ]),
        },
        sparkle1: {
          rotate: rotate([
            { t: 0, v: 0, ease: EASE.linear },
            { t: WIN_LOOP, v: -90 },
          ]),
          scale: scale([
            { t: 0, v: 1, ease: EASE.out },
            { t: 0.2, v: 1.45, ease: EASE.inOut },
            { t: 0.55, v: 0.9, ease: EASE.inOut },
            { t: WIN_LOOP, v: 1 },
          ]),
        },
        sparkle2: {
          rotate: rotate([
            { t: 0.4, v: 0, ease: EASE.linear },
            { t: 0.95, v: 90 },
          ]),
          scale: scale([
            { t: 0.4, v: 0.3, ease: EASE.out },
            { t: 0.65, v: 1.2, ease: EASE.in },
            { t: 0.95, v: 0.3 },
          ]),
        },
        rays: {
          // 12-fold symmetry: rotating by one ray step loops seamlessly.
          rotate: rotate([
            { t: 0, v: 0, ease: EASE.linear },
            { t: WIN_LOOP, v: -360 / RAY_COUNT },
          ]),
        },
      },
      slots: {
        glow: {
          rgba: alpha([
            { t: 0, v: 0.25, ease: EASE.out },
            { t: 0.3, v: 0.9, ease: EASE.inOut },
            { t: WIN_LOOP, v: 0.25 },
          ]),
        },
        rays: { rgba: alpha([{ t: 0, v: 0.75 }]) },
        sparkle2: {
          rgba: alpha([
            { t: 0.4, v: 0, ease: EASE.out },
            { t: 0.65, v: 1, ease: EASE.in },
            { t: 0.95, v: 0 },
          ]),
        },
      },
    },
  } satisfies Record<(typeof SYMBOL_ANIMATIONS)[SymbolAnimation], unknown>;
}

/** The complete Spine 4.3 skeleton JSON document. */
export function buildSkeleton() {
  const extent = 200;
  return {
    skeleton: {
      hash: 'gem-rush-symbols',
      spine: '4.3.00',
      x: -extent,
      y: -extent,
      width: extent * 2,
      height: extent * 2,
      images: './',
      audio: '',
    },
    bones: BONES,
    slots: SLOTS,
    skins: SYMBOL_IDS.map(skinFor),
    animations: animations(),
  };
}
