import { describe, expect, it } from 'vitest';

import { buildDailyChallengeShareMessage, buildDailyChallengeShareText, dailyChallengeFeedbackRow } from './dailyChallengeShare';

describe('Daily Challenge sharing', () => {
  it('builds a stable spoiler-free result for a win', () => {
    const text = buildDailyChallengeShareText({
      challengeNumber: 256,
      numberLength: 4,
      maxGuesses: 10,
      guesses: [
        { correctPositions: 1 },
        { correctPositions: 2 },
        { correctPositions: 4 },
      ],
      status: 'won',
    });

    expect(text).toBe('GuessX Daily #256 · 3/10\n🟩⬛⬛⬛\n🟩🟩⬛⬛\n🟩🟩🟩🟩');
    expect(text).not.toMatch(/1234|user|guest/i);
  });

  it('marks an exhausted challenge without exposing the answer', () => {
    expect(buildDailyChallengeShareText({
      challengeNumber: 256,
      numberLength: 4,
      maxGuesses: 10,
      guesses: [{ correctPositions: 0 }, { correctPositions: 3 }],
      status: 'exhausted',
    })).toBe('GuessX Daily #256 · X/10\n⬛⬛⬛⬛\n🟩🟩🟩⬛');
  });

  it('renders zero-correct-position feedback as neutral squares', () => {
    expect(dailyChallengeFeedbackRow(0, 4)).toBe('⬛⬛⬛⬛');
  });

  it('keeps the complete result and Daily Challenge link in one share message', () => {
    expect(buildDailyChallengeShareMessage({
      challengeNumber: 256,
      numberLength: 4,
      maxGuesses: 10,
      guesses: [{ correctPositions: 1 }],
      status: 'won',
    }, 'https://guessx.example/en/daily')).toBe('GuessX Daily #256 · 1/10\n🟩⬛⬛⬛\nhttps://guessx.example/en/daily');
  });

  it('includes a completed Daily Challenge streak without changing feedback rows', () => {
    expect(buildDailyChallengeShareText({
      challengeNumber: 256,
      numberLength: 4,
      maxGuesses: 10,
      guesses: [{ correctPositions: 2 }],
      status: 'won',
      streak: 12,
    })).toBe('GuessX Daily #256 · 1/10 · 🔥 12\n🟩🟩⬛⬛');
  });
});
