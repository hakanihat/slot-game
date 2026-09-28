import { describe, expect, it } from 'vitest';
import { formatDuration, formatMoney } from './format';

describe('formatMoney', () => {
  it('formats integer cents without floating point drift', () => {
    expect(formatMoney(12345, 'EUR')).toMatch(/123[.,]45/);
    expect(formatMoney(10, 'EUR')).toMatch(/0[.,]10/);
  });
});

describe('formatDuration', () => {
  it('renders hh:mm:ss', () => {
    expect(formatDuration(3_723_000)).toBe('01:02:03');
  });
});
