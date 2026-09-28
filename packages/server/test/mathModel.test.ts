import { GAME_CONFIG } from '@gem-rush/shared';
import { describe, expect, it } from 'vitest';
import { satisfiesSpacing } from '../src/domain/math/reelStrips.js';
import { GEM_RUSH_MODEL } from '../src/domain/math/reelSets.js';
import { SlotEngine } from '../src/domain/math/SlotEngine.js';
import { computeTheoreticalRtp } from '../src/domain/math/theoreticalRtp.js';
import { SeededRng } from '../src/domain/rng/SeededRng.js';

describe('math model', () => {
  const report = computeTheoreticalRtp(GEM_RUSH_MODEL);

  it('targets a 96% RTP (±0.5%)', () => {
    expect(report.totalRtp).toBeGreaterThan(0.955);
    expect(report.totalRtp).toBeLessThan(0.965);
  });

  it('triggers the feature roughly once every 150-250 spins', () => {
    expect(report.featureFrequency).toBeGreaterThan(150);
    expect(report.featureFrequency).toBeLessThan(250);
  });

  it('triggers the Gem Vault bonus roughly once every 200-400 spins', () => {
    expect(report.bonusFrequency).toBeGreaterThan(200);
    expect(report.bonusFrequency).toBeLessThan(400);
  });

  it('places BONUS only on the trigger reels of the base game', () => {
    GEM_RUSH_MODEL.reelSets.base.forEach((strip, reel) =>
      expect(strip.includes('BONUS')).toBe(
        (GAME_CONFIG.bonusGame.triggerReels as readonly number[]).includes(reel),
      ),
    );
    GEM_RUSH_MODEL.reelSets.freeSpins.forEach((strip) =>
      expect(strip.includes('BONUS')).toBe(false),
    );
  });

  it('keeps free spins retriggers bounded', () => {
    expect(report.freeSpins.expectedAward).toBeLessThan(0.5);
  });

  for (const [mode, reelSet] of Object.entries(GEM_RUSH_MODEL.reelSets)) {
    it(`${mode}: places wilds only on the configured reels`, () => {
      reelSet.forEach((strip, reel) => {
        const hasWild = strip.includes('WILD');
        expect(hasWild).toBe((GAME_CONFIG.wildReels as readonly number[]).includes(reel));
      });
    });

    it(`${mode}: never shows two scatters or two bonus symbols on one reel`, () => {
      reelSet.forEach((strip) =>
        expect(
          satisfiesSpacing(strip, {
            spacedSymbols: ['SCATTER', 'BONUS'],
            windowSize: GAME_CONFIG.rows,
          }),
        ).toBe(true),
      );
    });
  }

  it('agrees with a Monte Carlo sample of the production engine', () => {
    const engine = new SlotEngine(GEM_RUSH_MODEL, new SeededRng(7));
    const spins = 200_000;
    let won = 0;
    for (let i = 0; i < spins; i += 1) won += engine.spin('base', 20).totalWin;
    const baseRtp = won / (spins * 20);
    // Base game only (feature excluded) — loose bound, this is a smoke check.
    expect(Math.abs(baseRtp - report.baseRtp)).toBeLessThan(0.03);
  });
});
