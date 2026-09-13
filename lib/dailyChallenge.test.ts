import { describe, expect, it } from 'vitest';

import {
  DAILY_CHALLENGE_MAX_GUESSES,
  accountParticipantKey,
  challengeNumber,
  deriveDailySecret,
  guestParticipantKey,
  submitDailyGuess,
  toDailyChallengeResponse,
  utcChallengeDate,
} from './dailyChallenge';

describe('daily challenge', () => {
  it('uses one UTC date and deterministic server-derived secret', () => {
    expect(utcChallengeDate(new Date('2026-09-12T03:59:59.000Z'))).toBe('2026-09-12');
    expect(utcChallengeDate(new Date('2026-09-12T04:00:00.000Z'))).toBe('2026-09-12');
    expect(challengeNumber('2026-01-01')).toBe(1);
    expect(deriveDailySecret('2026-09-12', 'secret-a')).toBe(deriveDailySecret('2026-09-12', 'secret-a'));
    expect(deriveDailySecret('2026-09-12', 'secret-a')).not.toBe(deriveDailySecret('2026-09-13', 'secret-a'));
  });

  it('does not persist a raw guest identifier in the guest participant key', () => {
    const identifier = 'c0a8011b-1234-4000-8000-abcdefabcdef';
    expect(guestParticipantKey(identifier)).not.toContain(identifier);
    expect(guestParticipantKey(identifier)).toMatch(/^guest:[a-f0-9]{64}$/);
    expect(accountParticipantKey('user-123')).toBe('account:user-123');
  });

  it('returns feedback without revealing an active challenge answer', () => {
    const attempt = {
      challengeDate: '2026-09-12',
      participantKind: 'guest' as const,
      participantKey: 'guest:hash',
      guesses: [{ guess: '1256', correctPositions: 2, createdAt: new Date('2026-09-12T12:00:00.000Z') }],
      status: 'active' as const,
    };
    const response = toDailyChallengeResponse(attempt, '1234');
    expect(response).not.toHaveProperty('answer');
    expect(response.remainingGuesses).toBe(DAILY_CHALLENGE_MAX_GUESSES - 1);
  });

  it('locks a completed or exhausted attempt', () => {
    const active = { guesses: [], status: 'active' as const };
    expect(submitDailyGuess(active, '1234', '1234').status).toBe('won');
    const exhausted = {
      guesses: Array.from({ length: DAILY_CHALLENGE_MAX_GUESSES - 1 }, (_, index) => ({
        guess: `1${String(index).padStart(3, '0')}`,
        correctPositions: 0,
        createdAt: new Date(),
      })),
      status: 'active' as const,
    };
    expect(submitDailyGuess(exhausted, '9999', '1234').status).toBe('exhausted');
    expect(() => submitDailyGuess({ guesses: [], status: 'won' }, '1234', '1234')).toThrow('already complete');
  });

  it('rejects invalid guesses before calculating feedback', () => {
    expect(() => submitDailyGuess({ guesses: [], status: 'active' }, '123', '1234')).toThrow('four-digit');
  });
});
