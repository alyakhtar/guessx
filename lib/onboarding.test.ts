import { describe, expect, it, vi } from 'vitest';

import { hasSeenOnboarding, markOnboardingSeen, ONBOARDING_STORAGE_KEY } from './onboarding';

function memoryStorage(initialValue: string | null = null) {
  let value = initialValue;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, nextValue: string) => { value = nextValue; }),
  };
}

describe('first-visit onboarding storage', () => {
  it('is unseen until explicitly dismissed or completed', () => {
    const storage = memoryStorage();

    expect(hasSeenOnboarding(storage)).toBe(false);
    markOnboardingSeen(storage);
    expect(hasSeenOnboarding(storage)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(ONBOARDING_STORAGE_KEY, 'true');
  });

  it('does not treat other stored values as a completed walkthrough', () => {
    expect(hasSeenOnboarding(memoryStorage('false'))).toBe(false);
  });

  it('fails open when browser storage is unavailable', () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error('storage unavailable'); }),
      setItem: vi.fn(() => { throw new Error('storage unavailable'); }),
    };

    expect(hasSeenOnboarding(storage)).toBe(false);
    expect(() => markOnboardingSeen(storage)).not.toThrow();
  });
});
