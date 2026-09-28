/**
 * Presentation tuning — timings and thresholds that shape game *feel*.
 * Kept separate from the math: changing these never changes the odds.
 */
export interface SpeedProfile {
  /** Cells scrolled per second at full speed. */
  readonly reelSpeed: number;
  /** Minimum time reels spin before they may stop, even if the result is already in. */
  readonly minSpinMs: number;
  /** Delay between consecutive reels stopping. */
  readonly reelStopStaggerMs: number;
  /** Extra spin time for a reel that could complete a feature trigger. */
  readonly anticipationMs: number;
  /** How long all winning lines are shown before auto-continuing (autoplay / free spins). */
  readonly winShowMs: number;
  /** Pause between automatic spins. */
  readonly autoSpinDelayMs: number;
}

export const SPEED: Readonly<Record<'normal' | 'turbo', SpeedProfile>> = {
  normal: {
    reelSpeed: 22,
    minSpinMs: 700,
    reelStopStaggerMs: 170,
    anticipationMs: 1400,
    winShowMs: 1400,
    autoSpinDelayMs: 350,
  },
  turbo: {
    reelSpeed: 34,
    minSpinMs: 180,
    reelStopStaggerMs: 50,
    anticipationMs: 700,
    winShowMs: 700,
    autoSpinDelayMs: 120,
  },
};

/** Big-win tiers, as multiples of the total bet. Ordered low → high. */
export const WIN_TIERS = [
  { id: 'big', label: 'BIG WIN', minMultiple: 15 },
  { id: 'mega', label: 'MEGA WIN', minMultiple: 40 },
  { id: 'epic', label: 'EPIC WIN', minMultiple: 100 },
] as const;

export type WinTier = (typeof WIN_TIERS)[number];

/** Returns the highest tier reached by `win`, or `null` for a regular win. */
export function winTierFor(win: number, bet: number): WinTier | null {
  if (bet <= 0) return null;
  const multiple = win / bet;
  let reached: WinTier | null = null;
  for (const tier of WIN_TIERS) if (multiple >= tier.minMultiple) reached = tier;
  return reached;
}

/** Count-up duration scaled by win size so small wins don't hold the player up. */
export function rollupDurationMs(win: number, bet: number): number {
  const multiple = bet > 0 ? win / bet : 0;
  if (multiple < 1) return 400;
  if (multiple < 5) return 900;
  if (multiple < 15) return 1600;
  return Math.min(2500 + multiple * 20, 9000);
}

export const AUTOPLAY_SPIN_OPTIONS = [10, 25, 50, 100] as const;
/** Loss limits as multiples of the current bet; one is always required (responsible gaming). */
export const AUTOPLAY_LOSS_LIMIT_MULTIPLES = [10, 25, 50, 100] as const;

/** Colours per payline so overlapping wins stay distinguishable. */
export const PAYLINE_COLORS = [
  0xffd54a, 0x4ae3ff, 0xff5ca8, 0x7dff6a, 0xb88cff, 0xff9f43, 0x45f0c0, 0xff6b6b, 0x6bb8ff,
  0xf5ff6b, 0xff8cf0, 0x8cffd9, 0xffc38c, 0x9d8cff, 0x8cff9d, 0xff8c8c, 0x8cd9ff, 0xffe08c,
  0xd98cff, 0xc3ff8c,
];
