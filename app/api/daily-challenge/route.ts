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
  newGuestIdentifier?: string;
};

function configuredSecret() {
  return process.env.DAILY_CHALLENGE_SECRET?.trim() || null;
}

export async function dailyParticipant(): Promise<DailyParticipant> {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  if (userId) {
    return { kind: 'account', userId, participantKey: accountParticipantKey(userId) };
  }

  const cookieStore = await cookies();
  const existing = cookieStore.get(DAILY_CHALLENGE_GUEST_COOKIE)?.value;
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

export async function getCurrentDailyAttempt(participant: DailyParticipant, now = new Date()) {
  const secret = configuredSecret();
  if (!secret) throw new Error('Daily Challenge is unavailable');

  const challengeDate = utcChallengeDate(now);
  await connectToDatabase();
  const attempt = await DailyChallengeAttemptModel.findOneAndUpdate(
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
