import { randomInt } from 'node:crypto';
import type { Rng } from './Rng.js';

/**
 * Cryptographically secure RNG. `crypto.randomInt` uses rejection sampling,
 * so there is no modulo bias — a hard requirement for certified game RNGs.
 */
export class CryptoRng implements Rng {
  nextInt(maxExclusive: number): number {
    return randomInt(maxExclusive);
  }
}
