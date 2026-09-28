import { wait } from './tween';

/**
 * Lets the player cut presentation pauses short ("tap to skip"). Waits started
 * through the signal resolve early when `trigger()` is called. Listeners are
 * removed as soon as their wait settles, so long sessions never accumulate them.
 */
export class SkipSignal {
  private readonly listeners = new Set<() => void>();

  trigger(): void {
    const listeners = [...this.listeners];
    this.listeners.clear();
    listeners.forEach((listener) => listener());
  }

  wait(ms: number): Promise<void> {
    return this.race(wait(ms));
  }

  race(promise: Promise<void>): Promise<void> {
    let listener!: () => void;
    const skipped = new Promise<void>((resolve) => {
      listener = resolve;
      this.listeners.add(listener);
    });
    return Promise.race([promise, skipped]).finally(() => this.listeners.delete(listener));
  }
}
