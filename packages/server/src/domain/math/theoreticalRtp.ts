import { expectedBonusMultiplier, type SymbolId } from '@gem-rush/shared';
import type { MathModel, ReelSet } from './types.js';

export interface ModeBreakdown {
  /** Line RTP contribution per spin (as a fraction of total bet, before multiplier). */
  readonly lines: number;
  /** Scatter pay RTP contribution per spin (fraction of total bet, before multiplier). */
  readonly scatters: number;
  /** Probability of 3+ scatters on one spin. */
  readonly triggerProbability: number;
  /** Expected free spins awarded per spin. */
  readonly expectedAward: number;
}

export interface RtpReport {
  readonly base: ModeBreakdown;
  readonly freeSpins: ModeBreakdown;
  /** Expected number of free spins played per feature, retriggers included. */
  readonly expectedSpinsPerFeature: number;
  /** Average base-game spins between feature triggers. */
  readonly featureFrequency: number;
  readonly baseRtp: number;
  readonly featureRtp: number;
  /** Probability a base spin triggers the Gem Vault bonus. */
  readonly bonusProbability: number;
  /** Average base-game spins between bonus triggers. */
  readonly bonusFrequency: number;
  /** Expected bonus win, × total bet. */
  readonly bonusValue: number;
  readonly bonusRtp: number;
  readonly totalRtp: number;
}

/**
 * Exact (closed-form) RTP of the math model — no sampling error.
 *
 * - Lines: every stop is equally likely and reels are independent, so each
 *   cell on a line follows its reel's symbol distribution. The line EV is then
 *   a product of per-reel probabilities, identical for every line. With
 *   `lineBet = bet / lines`, the per-line EV in line-bet units *is* the line
 *   RTP for the whole spin.
 * - Scatters: the strip builder guarantees at most one scatter per visible
 *   window, so reel r shows a scatter with probability rows·count/length and
 *   the scatter count follows a Poisson-binomial distribution.
 * - Bonus: P(trigger) is the product of per-reel BONUS visibility on the
 *   trigger reels; its value has a closed form (see `expectedBonusMultiplier`).
 * - Free Spins: each feature spin can award more spins (a branching process),
 *   so the expected spins per feature is N / (1 − a) where a is the expected
 *   award per feature spin.
 */
export function computeTheoreticalRtp(model: MathModel): RtpReport {
  const { config } = model;
  const base = analyseReelSet(model, model.reelSets.base);
  const freeSpins = analyseReelSet(model, model.reelSets.freeSpins);

  if (freeSpins.expectedAward >= 1) {
    throw new Error('Free Spins retrigger rate is unbounded (expected award per spin ≥ 1)');
  }

  const multiplier = config.freeSpins.multiplier;
  const spinsPerAwardedSpin = 1 / (1 - freeSpins.expectedAward);
  const featureSpinValue = multiplier * (freeSpins.lines + freeSpins.scatters);
  const featureRtp = base.expectedAward * spinsPerAwardedSpin * featureSpinValue;
  const baseRtp = base.lines + base.scatters;
  const averageAward =
    base.triggerProbability > 0 ? base.expectedAward / base.triggerProbability : 0;

  // Bonus: reels are independent and each window holds at most one BONUS.
  const bonusProbability = config.bonusGame.triggerReels.reduce(
    (p, reel) => p * config.rows * symbolProbability(model.reelSets.base, reel, 'BONUS'),
    1,
  );
  const bonusValue = expectedBonusMultiplier(config.bonusGame);
  const bonusRtp = bonusProbability * bonusValue;

  return {
    base,
    freeSpins,
    expectedSpinsPerFeature: averageAward * spinsPerAwardedSpin,
    featureFrequency: base.triggerProbability > 0 ? 1 / base.triggerProbability : Infinity,
    baseRtp,
    featureRtp,
    bonusProbability,
    bonusFrequency: bonusProbability > 0 ? 1 / bonusProbability : Infinity,
    bonusValue,
    bonusRtp,
    totalRtp: baseRtp + featureRtp + bonusRtp,
  };
}

function analyseReelSet(model: MathModel, reelSet: ReelSet): ModeBreakdown {
  const { config } = model;
  const probability = (reel: number, symbol: SymbolId) => symbolProbability(reelSet, reel, symbol);

  if (probability(0, 'WILD') > 0) {
    throw new Error('Closed-form line RTP assumes no wilds on reel 1');
  }

  let lines = 0;
  for (const [symbol, pays] of Object.entries(config.linePays) as [
    SymbolId,
    Record<3 | 4 | 5, number>,
  ][]) {
    const matchOn = (reel: number) =>
      reel === 0 ? probability(0, symbol) : probability(reel, symbol) + probability(reel, 'WILD');
    for (const count of [3, 4, 5] as const) {
      let p = 1;
      for (let reel = 0; reel < count; reel += 1) p *= matchOn(reel);
      if (count < config.reels) p *= 1 - matchOn(count);
      lines += p * pays[count];
    }
  }

  const scatterPerReel = reelSet.map((_, reel) => config.rows * probability(reel, 'SCATTER'));
  const scatterCountDistribution = poissonBinomial(scatterPerReel);

  let scatters = 0;
  let triggerProbability = 0;
  let expectedAward = 0;
  scatterCountDistribution.forEach((p, count) => {
    if (count < 3) return;
    const key = Math.min(count, 5) as 3 | 4 | 5;
    scatters += p * config.scatterPays[key];
    triggerProbability += p;
    expectedAward += p * config.freeSpins.award[key];
  });

  return { lines, scatters, triggerProbability, expectedAward };
}

function symbolProbability(reelSet: ReelSet, reel: number, symbol: SymbolId): number {
  const strip = reelSet[reel] ?? [];
  return strip.length === 0 ? 0 : strip.filter((s) => s === symbol).length / strip.length;
}

/** Distribution of the number of successes over independent trials with different probabilities. */
function poissonBinomial(probabilities: readonly number[]): number[] {
  let distribution = [1];
  for (const p of probabilities) {
    const next = new Array<number>(distribution.length + 1).fill(0);
    distribution.forEach((q, k) => {
      next[k] = (next[k] ?? 0) + q * (1 - p);
      next[k + 1] = (next[k + 1] ?? 0) + q * p;
    });
    distribution = next;
  }
  return distribution;
}
