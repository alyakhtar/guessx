import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTO_DISMISS_MS,
  MAX_TOASTS,
  _resetToasts,
  dismissToast,
  getToasts,
  showToast,
  subscribe,
} from './toast';

describe('toast store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetToasts();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses danger by default, increments ids, and replaces state only on mutation', () => {
    const empty = getToasts();
    expect(getToasts()).toBe(empty);

    expect(showToast('first')).toBe(1);
    const first = getToasts();
    expect(first).toEqual([{ id: 1, message: 'first', variant: 'danger' }]);
    expect(first).not.toBe(empty);
    expect(getToasts()).toBe(first);

    expect(showToast('second')).toBe(2);
    const second = getToasts();
    expect(second).not.toBe(first);

    dismissToast(1);
    expect(getToasts()).not.toBe(second);
  });

  it('auto-dismisses at the exact timeout boundary and notifies once per mutation', () => {
    const listener = vi.fn();
    subscribe(listener);
    showToast('timed');

    expect(listener).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(AUTO_DISMISS_MS - 1);
    expect(getToasts()).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(getToasts()).toHaveLength(0);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('manual dismiss removes immediately and leaves its later timer silent', () => {
    const listener = vi.fn();
    subscribe(listener);
    const id = showToast('manual');

    dismissToast(id);
    expect(getToasts()).toHaveLength(0);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(() => vi.advanceTimersByTime(AUTO_DISMISS_MS)).not.toThrow();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps only the newest toasts and clears the evicted timer', () => {
    const ids = ['one', 'two', 'three', 'four'].map((message) => showToast(message));

    expect(getToasts().map(({ id }) => id)).toEqual(ids.slice(1));
    expect(vi.getTimerCount()).toBe(MAX_TOASTS);
    expect(() => vi.advanceTimersByTime(AUTO_DISMISS_MS)).not.toThrow();
    expect(getToasts()).toHaveLength(0);
  });

  it('does not notify when dismissing an unknown id', () => {
    const listener = vi.fn();
    subscribe(listener);

    dismissToast(999);
    expect(listener).not.toHaveBeenCalled();
  });

  it('stops notifications after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    unsubscribe();

    showToast('ignored');
    expect(listener).not.toHaveBeenCalled();
  });

  it('honours the success variant', () => {
    showToast('saved', { variant: 'success' });

    expect(getToasts()[0]?.variant).toBe('success');
  });
});
