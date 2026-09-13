export const DAILY_CHALLENGE_GUEST_STREAK_STORAGE_KEY = 'guessx:daily-challenge-completions:v1';

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'getItem' | 'setItem'>;

function utcPreviousDate(challengeDate: string) {
  return new Date(Date.parse(`${challengeDate}T00:00:00.000Z`) - 86_400_000).toISOString().slice(0, 10);
}

export function currentDailyChallengeStreak(completedDates: Iterable<string>, today: string) {
  const dates = new Set([...completedDates].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)));
  let cursor = dates.has(today) ? today : utcPreviousDate(today);
  let streak = 0;

  while (dates.has(cursor)) {
    streak += 1;
    cursor = utcPreviousDate(cursor);
  }

  return streak;
}

export function readGuestDailyChallengeCompletions(storage: StorageReader) {
  try {
    const value = storage.getItem(DAILY_CHALLENGE_GUEST_STREAK_STORAGE_KEY);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((date): date is string => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date))
      : [];
  } catch {
    return [];
  }
}

export function guestDailyChallengeStreak(storage: StorageReader, today: string) {
  return currentDailyChallengeStreak(readGuestDailyChallengeCompletions(storage), today);
}

export function recordGuestDailyChallengeCompletion(storage: StorageWriter, challengeDate: string) {
  const completedDates = [...new Set([...readGuestDailyChallengeCompletions(storage), challengeDate])].sort().slice(-400);
  try {
    storage.setItem(DAILY_CHALLENGE_GUEST_STREAK_STORAGE_KEY, JSON.stringify(completedDates));
  } catch {
    // A guest streak is a progressive enhancement. The daily result itself is
    // already safely persisted by the server-owned attempt.
  }
  return currentDailyChallengeStreak(completedDates, challengeDate);
}
