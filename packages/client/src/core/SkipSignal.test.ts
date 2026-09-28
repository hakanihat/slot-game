import { describe, expect, it } from 'vitest';
import { SkipSignal } from './SkipSignal';

describe('SkipSignal', () => {
  it('resolves a pending race when triggered', async () => {
    const signal = new SkipSignal();
    const never = new Promise<void>(() => undefined);
    const raced = signal.race(never);
    signal.trigger();
    await expect(raced).resolves.toBeUndefined();
  });

  it('drops listeners once their promise settles', async () => {
    const signal = new SkipSignal();
    await signal.race(Promise.resolve());
    expect((signal as unknown as { listeners: Set<unknown> }).listeners.size).toBe(0);
  });
});
