import { createHash, createHmac, randomUUID } from 'node:crypto';

import { calculateCorrectPositions, validateNumber } from './gameLogic';

export const DAILY_CHALLENGE_LENGTH = 4;
export const DAILY_CHALLENGE_MAX_GUESSES = 10;
const DAILY_CHALLENGE_EPOCH = Date.UTC(2026, 0, 1);

export type DailyChallengeStatus = 'active' | 'won' | 'exhausted';

export type DailyChallengeGuess = {
  guess: string;
  correctPositions: number;
  createdAt: Date | string;
};

export type DailyChallengeAttempt = {
  challengeDate: string;
  participantKind: 'account' | 'guest';
  participantKey: string;
  userId?: string;
  guesses: DailyChallengeGuess[];
  status: DailyChallengeStatus;
  completedAt?: Date | string;
};

export function utcChallengeDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function challengeNumber(challengeDate: string) {
  const date = new Date(`${challengeDate}T00:00:00.000Z`);
  return Math.floor((date.getTime() - DAILY_CHALLENGE_EPOCH) / 86_400_000) + 1;
}

function dailyCandidate(challengeDate: string, secret: string) {
  const digest = createHmac('sha256', secret)
    .update(`guessx:daily-challenge:v1:${challengeDate}`)
    .digest();
  return 1000 + (digest.readUInt32BE(0) % 9000);
}

export function deriveDailySecret(challengeDate: string, secret: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(challengeDate)) throw new Error('Invalid challenge date');
  if (!secret.trim()) throw new Error('DAILY_CHALLENGE_SECRET is required');

  // A date is part of the HMAC input, so every day selects a fresh opaque
  // candidate. Walk from the fixed epoch so the rare HMAC collision cannot
  // make two adjacent UTC days use the same answer.
  const target = Date.parse(`${challengeDate}T00:00:00.000Z`);
  if (target < DAILY_CHALLENGE_EPOCH) return String(dailyCandidate(challengeDate, secret));

  let previous: number | null = null;
  let current = DAILY_CHALLENGE_EPOCH;
  let selected = 1000;
  while (current <= target) {
    const currentDate = new Date(current).toISOString().slice(0, 10);
    selected = dailyCandidate(currentDate, secret);
    if (selected === previous) selected = selected === 9999 ? 1000 : selected + 1;
    previous = selected;
    current += 86_400_000;
  }
  return String(selected);
}

export function createGuestIdentifier() {
  return randomUUID();
}

export function guestParticipantKey(identifier: string) {
  return `guest:${createHash('sha256').update(`guessx:daily-guest:v1:${identifier}`).digest('hex')}`;
}

export function accountParticipantKey(userId: string) {
  return `account:${userId}`;
}

export function submitDailyGuess(
  attempt: Pick<DailyChallengeAttempt, 'guesses' | 'status'>,
  guess: string,
  secret: string,
  now = new Date(),
) {
  if (attempt.status !== 'active') throw new Error('Daily challenge is already complete');
  if (attempt.guesses.length >= DAILY_CHALLENGE_MAX_GUESSES) throw new Error('Daily challenge has no guesses remaining');
  if (!validateNumber(guess, DAILY_CHALLENGE_LENGTH)) throw new Error('Guess must be a four-digit number');
  if (attempt.guesses.some((entry) => entry.guess === guess)) throw new Error('You already tried this number');

  const correctPositions = calculateCorrectPositions(guess, secret);
  const guessEntry: DailyChallengeGuess = { guess, correctPositions, createdAt: now };
  const isWin = correctPositions === DAILY_CHALLENGE_LENGTH;
  const isExhausted = !isWin && attempt.guesses.length + 1 >= DAILY_CHALLENGE_MAX_GUESSES;

  return {
    guessEntry,
    status: isWin ? 'won' as const : isExhausted ? 'exhausted' as const : 'active' as const,
    completedAt: isWin || isExhausted ? now : undefined,
  };
}

export function toDailyChallengeResponse(attempt: DailyChallengeAttempt, secret: string) {
  const completed = attempt.status !== 'active';
  return {
    challengeDate: attempt.challengeDate,
    challengeNumber: challengeNumber(attempt.challengeDate),
    numberLength: DAILY_CHALLENGE_LENGTH,
    maxGuesses: DAILY_CHALLENGE_MAX_GUESSES,
    participantKind: attempt.participantKind,
    guesses: attempt.guesses.map(({ guess, correctPositions, createdAt }) => ({ guess, correctPositions, createdAt })),
    status: attempt.status,
    completedAt: attempt.completedAt ?? null,
    remainingGuesses: Math.max(DAILY_CHALLENGE_MAX_GUESSES - attempt.guesses.length, 0),
    ...(completed ? { answer: secret } : {}),
  };
}
