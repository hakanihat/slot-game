import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './ApiClient';
import { withRetry } from './retry';

const fast = { baseDelayMs: 1, maxDelayMs: 1 };

describe('withRetry', () => {
  it('retries transient failures until the task succeeds', async () => {
    const task = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ApiError('NETWORK', 'down'))
      .mockRejectedValueOnce(new ApiError('INTERNAL', 'proxy error', 502))
      .mockResolvedValue('ok');
    const onRetry = vi.fn();
    await expect(withRetry(task, { ...fast, onRetry })).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('does not retry errors the server returned on purpose', async () => {
    const task = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(new ApiError('UNAUTHORIZED', 'no', 401));
    await expect(withRetry(task, fast)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('gives up after the configured number of attempts', async () => {
    const task = vi.fn<() => Promise<string>>().mockRejectedValue(new ApiError('NETWORK', 'down'));
    await expect(withRetry(task, { ...fast, attempts: 3 })).rejects.toMatchObject({
      code: 'NETWORK',
    });
    expect(task).toHaveBeenCalledTimes(3);
  });
});
