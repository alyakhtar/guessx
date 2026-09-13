import { NextResponse } from 'next/server';

import {
  DAILY_CHALLENGE_MAX_GUESSES,
  submitDailyGuess,
  toDailyChallengeResponse,
} from '../../../../lib/dailyChallenge';
import DailyChallengeAttemptModel from '../../../../lib/models/DailyChallengeAttempt.model';
import {
  applyGuestCookie,
  dailyParticipant,
  getCurrentDailyAttempt,
  toAttempt,
} from '../route';

export const runtime = 'nodejs';

function clientError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: { guess?: unknown };
  try {
    body = await request.json();
  } catch {
    return clientError('A guess is required');
  }

  if (typeof body.guess !== 'string') return clientError('A guess is required');

  try {
    const participant = await dailyParticipant();
    const { attempt, secret } = await getCurrentDailyAttempt(participant);
    const update = submitDailyGuess(attempt, body.guess, secret);
    const updated = await DailyChallengeAttemptModel.findOneAndUpdate(
      {
        challengeDate: attempt.challengeDate,
        participantKey: participant.participantKey,
        status: 'active',
        [`guesses.${DAILY_CHALLENGE_MAX_GUESSES - 1}`]: { $exists: false },
      },
      {
        $push: { guesses: update.guessEntry },
        $set: {
          status: update.status,
          ...(update.completedAt ? { completedAt: update.completedAt } : {}),
        },
      },
      { new: true },
    ).lean();

    if (!updated) {
      return clientError('This daily attempt was updated elsewhere. Refresh and try again.', 409);
    }

    return applyGuestCookie(
      NextResponse.json(toDailyChallengeResponse(toAttempt(updated), secret), { headers: { 'Cache-Control': 'no-store' } }),
      participant,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Daily Challenge is unavailable';
    if (message.includes('four-digit') || message.includes('already complete') || message.includes('no guesses remaining') || message.includes('already tried')) {
      return clientError(message, 409);
    }
    console.error('Unable to submit daily challenge guess:', error);
    return NextResponse.json({ error: 'Daily Challenge is unavailable' }, { status: 503 });
  }
}
