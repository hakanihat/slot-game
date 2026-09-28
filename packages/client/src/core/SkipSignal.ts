import { wait } from './tween';

/**
 * Lets the player cut presentation pauses short ("tap to skip"). Waits started
 * through the signal resolve early when `trigger()` is called.
 */
export class SkipSignal {
  private listeners: (() => void)[] = [];

  trigger(): void {
    const listeners = this.listeners;
    this.listeners = [];
    listeners.forEach((listener) => listener());
  }

  wait(ms: number): Promise<void> {
    return this.race(wait(ms));
  }

  race(promise: Promise<void>): Promise<void> {
    return Promise.race([promise, new Promise<void>((resolve) => this.listeners.push(resolve))]);
  }
}
