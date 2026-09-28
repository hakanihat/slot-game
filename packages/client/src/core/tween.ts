import { Ticker } from 'pixi.js';

export type Easing = (t: number) => number;

export const Ease = {
  linear: (t: number) => t,
  quadOut: (t: number) => 1 - (1 - t) * (1 - t),
  quadIn: (t: number) => t * t,
  cubicOut: (t: number) => 1 - (1 - t) ** 3,
  cubicInOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  backOut: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  elasticOut: (t: number) =>
    t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
} satisfies Record<string, Easing>;

type NumericKeys<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T];

export interface TweenOptions {
  readonly duration: number;
  readonly ease?: Easing;
  readonly delay?: number;
  readonly onUpdate?: () => void;
}

export interface TweenHandle {
  readonly finished: Promise<void>;
  /** Jumps to the end state and resolves. */
  complete(): void;
  /** Stops where it is and resolves. */
  cancel(): void;
}

/**
 * Tiny tween engine driven by Pixi's shared ticker — enough for a slot game
 * without pulling in a 3rd-party animation library. Durations are in ms.
 */
export function tween<T extends object>(
  target: T,
  to: Partial<Pick<T, NumericKeys<T>>>,
  { duration, ease = Ease.quadOut, delay = 0, onUpdate }: TweenOptions,
): TweenHandle {
  const keys = Object.keys(to) as NumericKeys<T>[];
  const from = new Map(keys.map((key) => [key, target[key] as number]));
  let elapsed = -delay;
  let resolve!: () => void;
  const finished = new Promise<void>((r) => (resolve = r));

  const apply = (progress: number) => {
    const eased = ease(progress);
    for (const key of keys) {
      const start = from.get(key) ?? 0;
      (target[key] as number) = start + ((to[key] as number) - start) * eased;
    }
    onUpdate?.();
  };

  const stop = () => {
    Ticker.shared.remove(tick);
    resolve();
  };

  const tick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS;
    if (elapsed < 0) return;
    const progress = duration <= 0 ? 1 : Math.min(elapsed / duration, 1);
    apply(progress);
    if (progress >= 1) stop();
  };

  Ticker.shared.add(tick);
  return {
    finished,
    complete: () => {
      apply(1);
      stop();
    },
    cancel: stop,
  };
}

/** Promise-based delay on the shared ticker (pauses with the game, unlike setTimeout). */
export function wait(ms: number): Promise<void> {
  return tween({ t: 0 }, { t: 1 }, { duration: ms, ease: Ease.linear }).finished;
}
