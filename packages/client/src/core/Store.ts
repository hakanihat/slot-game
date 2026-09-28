type Listener<T> = (state: T, previous: T) => void;

/**
 * Minimal observable store. The single source of truth for UI state: the game
 * controller writes, HUD components subscribe to the slices they render.
 */
export class Store<T extends object> {
  private listeners = new Set<Listener<T>>();

  constructor(private state: T) {}

  get(): T {
    return this.state;
  }

  set(patch: Partial<T> | ((state: T) => Partial<T>)): void {
    const previous = this.state;
    const changes = typeof patch === 'function' ? patch(previous) : patch;
    this.state = { ...previous, ...changes };
    this.listeners.forEach((listener) => listener(this.state, previous));
  }

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Calls `listener` with the selected value now and whenever it changes. */
  select<S>(selector: (state: T) => S, listener: (value: S) => void): () => void {
    let current = selector(this.state);
    listener(current);
    return this.subscribe((state) => {
      const next = selector(state);
      if (!Object.is(next, current)) {
        current = next;
        listener(next);
      }
    });
  }
}
