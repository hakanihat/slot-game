import type { Rng } from './Rng.js';

/**
 * Returns a pre-defined sequence of values. Lets tests force exact reel stops
 * ("cheat tool" in slot studio parlance) to verify specific outcomes.
 */
export class ScriptedRng implements Rng {
  private index = 0;

  constructor(private readonly values: readonly number[]) {}

  nextInt(maxExclusive: number): number {
    const value = this.values[this.index % this.values.length];
    this.index += 1;
    if (value === undefined || value < 0 || value >= maxExclusive) {
      throw new RangeError(`Scripted value ${String(value)} out of range [0, ${maxExclusive})`);
    }
    return value;
  }
}
