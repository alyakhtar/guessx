import { describe, expect, it } from 'vitest';

import { TRACKED_DIGITS, nextDigitTrackerState } from './digitTracker';

describe('digit tracker', () => {
  it('cycles unknown, eliminated, confirmed, then unknown', () => {
    expect(nextDigitTrackerState('unknown')).toBe('eliminated');
    expect(nextDigitTrackerState('eliminated')).toBe('confirmed');
    expect(nextDigitTrackerState('confirmed')).toBe('unknown');
  });

  it('offers every decimal digit exactly once', () => {
    expect(TRACKED_DIGITS).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });
});
