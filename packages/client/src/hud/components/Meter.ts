import { el } from '../../core/dom';

/**
 * Labelled money display (BALANCE / BET / WIN). Supports an animated
 * count-up so wins feel earned, and can be skipped instantly.
 */
export class Meter {
  readonly element: HTMLElement;
  private readonly valueEl: HTMLElement;
  private frame = 0;
  private finish: (() => void) | null = null;

  constructor(
    label: string,
    private readonly format: (value: number) => string,
    className = '',
  ) {
    this.valueEl = el('span', { class: 'meter__value' });
    this.element = el('div', { class: `meter ${className}` }, [
      el('span', { class: 'meter__label', text: label }),
      this.valueEl,
    ]);
  }

  set(value: number): void {
    this.cancel();
    this.valueEl.textContent = this.format(value);
  }

  /** Counts from `from` to `to` over `durationMs`; resolves on completion or skip. */
  rollup(from: number, to: number, durationMs: number): Promise<void> {
    this.cancel();
    this.element.classList.add('meter--rolling');
    return new Promise((resolve) => {
      const start = performance.now();
      this.finish = () => {
        cancelAnimationFrame(this.frame);
        this.valueEl.textContent = this.format(to);
        this.element.classList.remove('meter--rolling');
        this.finish = null;
        resolve();
      };
      const step = (now: number) => {
        const t = Math.min((now - start) / durationMs, 1);
        const eased = 1 - (1 - t) ** 3;
        this.valueEl.textContent = this.format(Math.round(from + (to - from) * eased));
        if (t < 1) this.frame = requestAnimationFrame(step);
        else this.finish?.();
      };
      this.frame = requestAnimationFrame(step);
    });
  }

  /** Jumps an in-progress rollup to its final value. */
  skip(): void {
    this.finish?.();
  }

  private cancel(): void {
    this.finish?.();
  }
}
