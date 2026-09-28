/**
 * Random number source abstraction. Production uses a CSPRNG; tests and the
 * RTP simulator inject a seeded generator so results are reproducible.
 */
export interface Rng {
  /** Uniform integer in `[0, maxExclusive)`. */
  nextInt(maxExclusive: number): number;
}
