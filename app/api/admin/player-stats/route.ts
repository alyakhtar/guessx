import { NextResponse } from 'next/server';
import connectToDatabase from '../../../../lib/mongodb';
import GameResultModel from '../../../../lib/models/GameResult.model';
import { authorizeAdminRequest } from '../../../../lib/adminAuth';
import { buildPlayerStats } from '../../../../lib/gameResults/stats';

export async function GET(request: Request) {
    const authorization = await authorizeAdminRequest(request);
    if (authorization.ok === false) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: authorization.status });
    }

    try {
        if (process.env.NODE_ENV !== 'production') {
            console.log('🚀 API GET route called for /api/admin/player-stats');
        }
        await connectToDatabase();

        const gameResults = await (GameResultModel as any).find({}).lean();
        return NextResponse.json(buildPlayerStats(gameResults));
    } catch (error) {
        console.error('Error fetching player stats:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
