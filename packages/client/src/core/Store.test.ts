import { describe, expect, it, vi } from 'vitest';
import { Store } from './Store';

describe('Store', () => {
  it('merges patches and notifies subscribers with the previous state', () => {
    const store = new Store({ a: 1, b: 'x' });
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ a: 2 });
    expect(store.get()).toEqual({ a: 2, b: 'x' });
    expect(listener).toHaveBeenCalledWith({ a: 2, b: 'x' }, { a: 1, b: 'x' });
  });

  it('only fires selectors when the selected slice changes', () => {
    const store = new Store({ a: 1, b: 'x' });
    const listener = vi.fn();
    store.select((s) => s.a, listener);
    store.set({ b: 'y' });
    store.set((s) => ({ a: s.a + 1 }));
    expect(listener.mock.calls).toEqual([[1], [2]]);
  });

  it('stops notifying after unsubscribe', () => {
    const store = new Store({ a: 1 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set({ a: 2 });
    expect(listener).not.toHaveBeenCalled();
  });
});
