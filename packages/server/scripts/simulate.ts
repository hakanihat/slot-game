/* eslint-disable no-console -- CLI tool whose job is printing tables */
/**
 * Monte Carlo simulator. Plays N base-game rounds (each including any Free
 * Spins it triggers) through the production SlotEngine and compares the
 * measured RTP with the closed-form value.
 *
 *   npm run simulate -- [rounds=2000000] [seed=42]
 */
import { GAME_CONFIG } from '@gem-rush/shared';
import { bonusMultiplierOf, drawBonusSequence } from '../src/domain/bonus/bonusSequence.js';
import { GEM_RUSH_MODEL } from '../src/domain/math/reelSets.js';
import { SlotEngine } from '../src/domain/math/SlotEngine.js';
import { computeTheoreticalRtp } from '../src/domain/math/theoreticalRtp.js';
import { SeededRng } from '../src/domain/rng/SeededRng.js';

const rounds = Number(process.argv[2] ?? 2_000_000);
const seed = Number(process.argv[3] ?? 42);
const bet = GAME_CONFIG.betLevels[0];

const engine = new SlotEngine(GEM_RUSH_MODEL, new SeededRng(seed));
const bonusRng = new SeededRng(seed + 1);
const WIN_BUCKETS = [0, 1, 2, 5, 10, 25, 50, 100, 250, 500, Infinity];
const bucketCounts = new Array<number>(WIN_BUCKETS.length - 1).fill(0);

let totalBet = 0;
let totalWin = 0;
let baseWin = 0;
let featureWin = 0;
let bonusWin = 0;
let bonuses = 0;
let hits = 0;
let features = 0;
let featureSpins = 0;
let sumSquares = 0;
let maxWin = 0;

const started = performance.now();
for (let i = 0; i < rounds; i += 1) {
  totalBet += bet;
  const base = engine.spin('base', bet);
  let roundWin = base.totalWin;
  baseWin += base.totalWin;

  if (base.bonusTrigger) {
    bonuses += 1;
    const win =
      bonusMultiplierOf(drawBonusSequence(GEM_RUSH_MODEL.config.bonusGame, bonusRng)) * bet;
    roundWin += win;
    bonusWin += win;
  }

  let remaining = base.freeSpinsAwarded;
  if (remaining > 0) features += 1;
  while (remaining > 0) {
    const spin = engine.spin('freeSpins', bet);
    roundWin += spin.totalWin;
    featureWin += spin.totalWin;
    remaining += spin.freeSpinsAwarded - 1;
    featureSpins += 1;
  }

  totalWin += roundWin;
  if (roundWin > 0) hits += 1;
  const multiple = roundWin / bet;
  sumSquares += multiple * multiple;
  maxWin = Math.max(maxWin, multiple);
  const bucket = WIN_BUCKETS.findIndex(
    (edge, b) => multiple >= edge && multiple < (WIN_BUCKETS[b + 1] ?? Infinity),
  );
  if (multiple > 0 && bucket >= 0) bucketCounts[bucket] = (bucketCounts[bucket] ?? 0) + 1;
}
const seconds = (performance.now() - started) / 1000;

const rtp = totalWin / totalBet;
const mean = rtp;
const stdDev = Math.sqrt(sumSquares / rounds - mean * mean);
const confidence95 = (1.96 * stdDev) / Math.sqrt(rounds);
const theory = computeTheoreticalRtp(GEM_RUSH_MODEL);
const pct = (x: number) => `${(x * 100).toFixed(3)}%`;

console.info(
  `\nGem Rush — ${rounds.toLocaleString()} rounds (seed ${seed}) in ${seconds.toFixed(1)}s\n`,
);
console.table({
  'Total RTP': { simulated: pct(rtp), theoretical: pct(theory.totalRtp) },
  'Base game RTP': { simulated: pct(baseWin / totalBet), theoretical: pct(theory.baseRtp) },
  'Free Spins RTP': { simulated: pct(featureWin / totalBet), theoretical: pct(theory.featureRtp) },
  'Gem Vault bonus RTP': { simulated: pct(bonusWin / totalBet), theoretical: pct(theory.bonusRtp) },
  'Bonus frequency (1 in)': {
    simulated: (rounds / Math.max(bonuses, 1)).toFixed(1),
    theoretical: theory.bonusFrequency.toFixed(1),
  },
  'Feature frequency (1 in)': {
    simulated: (rounds / Math.max(features, 1)).toFixed(1),
    theoretical: theory.featureFrequency.toFixed(1),
  },
  'Spins per feature': {
    simulated: (featureSpins / Math.max(features, 1)).toFixed(2),
    theoretical: theory.expectedSpinsPerFeature.toFixed(2),
  },
});
console.table({
  'Hit frequency': pct(hits / rounds),
  'Std deviation (volatility)': stdDev.toFixed(2),
  '95% confidence (±RTP)': pct(confidence95),
  'Max win (x bet)': maxWin.toFixed(1),
});
console.info('Win distribution (x total bet):');
console.table(
  bucketCounts.map((count, b) => ({
    range: `${WIN_BUCKETS[b]}x – ${WIN_BUCKETS[b + 1] === Infinity ? '∞' : `${WIN_BUCKETS[b + 1]}x`}`,
    'rounds (1 in)': count > 0 ? (rounds / count).toFixed(1) : '—',
  })),
);
