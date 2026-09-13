import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { auth } from '../../../auth';
import connectToDatabase from '../../../lib/mongodb';
import {
  accountParticipantKey,
  createGuestIdentifier,
  deriveDailySecret,
  guestParticipantKey,
  toDailyChallengeResponse,
  utcChallengeDate,
  type DailyChallengeAttempt,
} from '../../../lib/dailyChallenge';
import DailyChallengeAttemptModel from '../../../lib/models/DailyChallengeAttempt.model';

export const runtime = 'nodejs';

export const DAILY_CHALLENGE_GUEST_COOKIE = 'guessx_daily_challenge_guest';

type DailyParticipant = {
  kind: 'account' | 'guest';
  participantKey: string;
  userId?: string;
  guestParticipantKey?: string;
  newGuestIdentifier?: string;
};

function configuredSecret() {
  return process.env.DAILY_CHALLENGE_SECRET?.trim() || null;
}

export async function dailyParticipant(): Promise<DailyParticipant> {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  const cookieStore = await cookies();
  const existing = cookieStore.get(DAILY_CHALLENGE_GUEST_COOKIE)?.value;
  const existingGuestParticipantKey = existing && /^[a-f0-9-]{36}$/i.test(existing)
    ? guestParticipantKey(existing)
    : undefined;

  if (userId) {
    return {
      kind: 'account',
      userId,
      participantKey: accountParticipantKey(userId),
      ...(existingGuestParticipantKey ? { guestParticipantKey: existingGuestParticipantKey } : {}),
    };
  }

  const identifier = existing && /^[a-f0-9-]{36}$/i.test(existing) ? existing : createGuestIdentifier();
  return {
    kind: 'guest',
    participantKey: guestParticipantKey(identifier),
    ...(identifier === existing ? {} : { newGuestIdentifier: identifier }),
  };
}

export function applyGuestCookie(response: NextResponse, participant: DailyParticipant) {
  if (!participant.newGuestIdentifier) return response;
  response.cookies.set(DAILY_CHALLENGE_GUEST_COOKIE, participant.newGuestIdentifier, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

type StoredAttempt = {
  challengeDate: string;
  participantKind: 'account' | 'guest';
  participantKey: string;
  userId?: { toString(): string } | string;
  guesses?: DailyChallengeAttempt['guesses'];
  status: DailyChallengeAttempt['status'];
  completedAt?: Date | string;
};

function toAttempt(value: StoredAttempt): DailyChallengeAttempt {
  return {
    challengeDate: value.challengeDate,
    participantKind: value.participantKind,
    participantKey: value.participantKey,
    ...(value.userId ? { userId: String(value.userId) } : {}),
    guesses: value.guesses ?? [],
    status: value.status,
    ...(value.completedAt ? { completedAt: value.completedAt } : {}),
  };
}

function isDuplicateKeyError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 11000;
}

async function createAttempt(participant: DailyParticipant, challengeDate: string) {
  return DailyChallengeAttemptModel.findOneAndUpdate(
    { challengeDate, participantKey: participant.participantKey },
    {
      $setOnInsert: {
        challengeDate,
        participantKind: participant.kind,
        participantKey: participant.participantKey,
        ...(participant.userId ? { userId: participant.userId } : {}),
        guesses: [],
        status: 'active',
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
}

async function accountAttemptForToday(participant: DailyParticipant, challengeDate: string) {
  const existing = await DailyChallengeAttemptModel.findOne({
    challengeDate,
    participantKey: participant.participantKey,
  }).lean();
  if (existing) return existing;

  // A guest who signs in from this browser keeps the exact same attempt.
  // If the account already completed the day elsewhere, the unique index wins
  // and the unclaimed guest record cannot add a second account result.
  if (participant.guestParticipantKey) {
    try {
      const claimed = await DailyChallengeAttemptModel.findOneAndUpdate(
        {
          challengeDate,
          participantKey: participant.guestParticipantKey,
          participantKind: 'guest',
        },
        {
          $set: {
            participantKind: 'account',
            participantKey: participant.participantKey,
            userId: participant.userId,
          },
        },
        { new: true },
      ).lean();
      if (claimed) return claimed;
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
  }

  try {
    return await createAttempt(participant, challengeDate);
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const accountAttempt = await DailyChallengeAttemptModel.findOne({
      challengeDate,
      participantKey: participant.participantKey,
    }).lean();
    if (accountAttempt) return accountAttempt;
    throw error;
  }
}

export async function getCurrentDailyAttempt(participant: DailyParticipant, now = new Date()) {
  const secret = configuredSecret();
  if (!secret) throw new Error('Daily Challenge is unavailable');

  const challengeDate = utcChallengeDate(now);
  await connectToDatabase();
  const attempt = participant.kind === 'account'
    ? await accountAttemptForToday(participant, challengeDate)
    : await createAttempt(participant, challengeDate);
  return { attempt: toAttempt(attempt), secret: deriveDailySecret(challengeDate, secret) };
}

export async function GET() {
  try {
    const participant = await dailyParticipant();
    const { attempt, secret } = await getCurrentDailyAttempt(participant);
    return applyGuestCookie(NextResponse.json(toDailyChallengeResponse(attempt, secret), { headers: { 'Cache-Control': 'no-store' } }), participant);
  } catch (error) {
    console.error('Unable to load daily challenge:', error);
    return NextResponse.json({ error: 'Daily Challenge is unavailable' }, { status: 503 });
  }
}

export { configuredSecret, toAttempt };
