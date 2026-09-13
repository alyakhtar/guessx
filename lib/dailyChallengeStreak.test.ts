import { describe, expect, it } from 'vitest';

import {
  DAILY_CHALLENGE_GUEST_STREAK_STORAGE_KEY,
  currentDailyChallengeStreak,
  guestDailyChallengeStreak,
  readGuestDailyChallengeCompletions,
  recordGuestDailyChallengeCompletion,
} from './dailyChallengeStreak';

function memoryStorage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
  };
}

describe('Daily Challenge streaks', () => {
  it('counts consecutive UTC completion dates through today', () => {
    expect(currentDailyChallengeStreak(['2026-09-10', '2026-09-11', '2026-09-12'], '2026-09-12')).toBe(3);
  });

  it('keeps yesterday’s streak until the player actually misses a UTC day', () => {
    expect(currentDailyChallengeStreak(['2026-09-10', '2026-09-11'], '2026-09-12')).toBe(2);
    expect(currentDailyChallengeStreak(['2026-09-10'], '2026-09-12')).toBe(0);
  });

  it('deduplicates dates and ignores invalid stored values', () => {
    expect(currentDailyChallengeStreak(['2026-09-12', '2026-09-12', 'not-a-date'], '2026-09-12')).toBe(1);
  });

  it('records and restores a guest streak from local storage', () => {
    const storage = memoryStorage();
    expect(recordGuestDailyChallengeCompletion(storage, '2026-09-11')).toBe(1);
    expect(recordGuestDailyChallengeCompletion(storage, '2026-09-12')).toBe(2);
    expect(guestDailyChallengeStreak(storage, '2026-09-12')).toBe(2);
    expect(readGuestDailyChallengeCompletions(storage)).toEqual(['2026-09-11', '2026-09-12']);
  });

  it('treats corrupt local storage as an empty guest history', () => {
    const storage = memoryStorage('{not-json');
    expect(readGuestDailyChallengeCompletions(storage)).toEqual([]);
    expect(guestDailyChallengeStreak(storage, '2026-09-12')).toBe(0);
    expect(DAILY_CHALLENGE_GUEST_STREAK_STORAGE_KEY).toContain('daily-challenge');
  });
});
