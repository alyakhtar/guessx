import { NextResponse } from 'next/server';

import { auth } from '../../../../auth';
import { buildAccountStats, type GameResultRecord } from '../../../../lib/gameResults/stats';
import GameResultModel from '../../../../lib/models/GameResult.model';
import connectToDatabase from '../../../../lib/mongodb';

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();
    const gameResultModel = GameResultModel as unknown as {
      find(filter: Record<string, unknown>): { lean(): Promise<GameResultRecord[]> };
    };
    const gameResults = await gameResultModel.find({
      $or: [{ player1UserId: userId }, { player2UserId: userId }],
    }).lean();
    const displayName = session.user.name || session.user.email || 'Player';
    return NextResponse.json(buildAccountStats(gameResults, userId, displayName), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Error fetching personal player stats:', error);
    return NextResponse.json({ error: 'Unable to load player statistics' }, { status: 500 });
  }
}
