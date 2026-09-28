import { describe, expect, it } from 'vitest';
import { rollupDurationMs, winTierFor } from './presentation';

describe('winTierFor', () => {
  it('classifies wins by multiple of the bet', () => {
    expect(winTierFor(1_000, 100)).toBeNull();
    expect(winTierFor(1_500, 100)?.id).toBe('big');
    expect(winTierFor(4_000, 100)?.id).toBe('mega');
    expect(winTierFor(25_000, 100)?.id).toBe('epic');
  });

  it('is safe for a zero bet', () => {
    expect(winTierFor(100, 0)).toBeNull();
  });
});

describe('rollupDurationMs', () => {
  it('grows with the win size and is capped', () => {
    expect(rollupDurationMs(50, 100)).toBeLessThan(rollupDurationMs(500, 100));
    expect(rollupDurationMs(10_000_000, 100)).toBe(9000);
  });
});
