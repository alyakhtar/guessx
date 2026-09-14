import { NextResponse } from 'next/server';

import { auth } from '../../../../auth';
import { authorizeAdmin } from '../../../../lib/adminAuth';
import { buildDailyGameplayMetrics, type DailyAdminStatsRecord } from '../../../../lib/dailyAdminStats';
import connectToDatabase from '../../../../lib/mongodb';
import DailyChallengeAttemptModel from '../../../../lib/models/DailyChallengeAttempt.model';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const authorization = await authorizeAdmin(request.headers, await auth().catch(() => null));
  if (authorization.ok === false) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: authorization.status });
  }

  const requestedDate = new URL(request.url).searchParams.get('date') ?? utcToday();
  if (!DATE_PATTERN.test(requestedDate)) {
    return NextResponse.json({ error: 'date must use YYYY-MM-DD format' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const attemptModel = DailyChallengeAttemptModel as unknown as {
      find(filter: Record<string, unknown>): {
        select(fields: Record<string, number>): { lean(): Promise<DailyAdminStatsRecord[]> };
      };
    };
    const records = await attemptModel.find({})
      .select({ participantKind: 1, status: 1, guesses: 1, challengeDate: 1 })
      .lean();

    return NextResponse.json({
      date: requestedDate,
      overall: buildDailyGameplayMetrics(records),
      selectedDay: buildDailyGameplayMetrics(records.filter((record) => record.challengeDate === requestedDate)),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load Daily Challenge admin statistics:', error);
    return NextResponse.json({ error: 'Unable to load Daily Challenge statistics' }, { status: 500 });
  }
}
