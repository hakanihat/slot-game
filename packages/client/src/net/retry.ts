import { ApiError } from './ApiClient';

export interface RetryOptions {
  readonly attempts?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  /** Called before each retry, e.g. to tell the player we're still connecting. */
  readonly onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Retries a task on transient API failures with exponential backoff. Used at
 * boot so a server that is still starting (or briefly restarting) doesn't
 * leave the player on a dead error screen.
 */
export async function withRetry<T>(
  task: () => Promise<T>,
  { attempts = 6, baseDelayMs = 400, maxDelayMs = 4000, onRetry }: RetryOptions = {},
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      const transient = error instanceof ApiError && error.isTransient;
      if (!transient || attempt >= attempts) throw error;
      onRetry?.(attempt, error);
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
