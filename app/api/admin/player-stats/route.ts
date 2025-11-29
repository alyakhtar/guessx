import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '../../../../lib/mongodb';
import GameResultModel from '../../../../lib/models/GameResult.model';

export async function GET(request: Request) {
    try {
        if (process.env.NODE_ENV !== 'production') {
            console.log('🚀 API GET route called for /api/admin/player-stats');
        }
        await connectToDatabase();

        const { searchParams } = new URL(request.url);
        const player1 = searchParams.get('player1');
        const player2 = searchParams.get('player2');

        // If specific players are requested, return vs stats
        if (player1 && player2) {
            const gameResults = await (GameResultModel as any).find({
                $or: [
                    { player1, player2 },
                    { player1: player2, player2: player1 }
                ]
            }).lean();

            let player1Wins = 0;
            let player2Wins = 0;
            let totalGames = 0;

            gameResults.forEach((game: any) => {
                totalGames++;
                if (game.winner === player1) {
                    player1Wins++;
                } else if (game.winner === player2) {
                    player2Wins++;
                }
            });

            return NextResponse.json({
                player1: {
                    name: player1,
                    wins: player1Wins,
                    totalGames
                },
                player2: {
                    name: player2,
                    wins: player2Wins,
                    totalGames
                },
                totalGames
            });
        }

        // Get all game results
        const gameResults = await (GameResultModel as any).find({}).lean();

        // Aggregate stats by player
        const playerStats: { [key: string]: any } = {};

        gameResults.forEach((game: any) => {
            const players = [game.player1, game.player2];

            players.forEach(playerName => {
                if (!playerStats[playerName]) {
                    playerStats[playerName] = {
                        name: playerName,
                        totalGames: 0,
                        wins: 0,
                        losses: 0,
                        winRate: 0,
                        vsHumanGames: 0,
                        vsHumanWins: 0,
                        vsBotGames: 0,
                        vsBotWins: 0,
                        averageGuesses: 0,
                        totalGuesses: 0,
                        fastestWin: null,
                        slowestWin: null,
                        recentGames: []
                    };
                }

                const stats = playerStats[playerName];
                stats.totalGames++;

                if (game.winner === playerName) {
                    stats.wins++;
                    // Track game duration for wins
                    if (game.gameDuration !== undefined && game.gameDuration !== null) {
                        if (stats.fastestWin === null || game.gameDuration < stats.fastestWin) {
                            stats.fastestWin = game.gameDuration;
                        }
                        if (stats.slowestWin === null || game.gameDuration > stats.slowestWin) {
                            stats.slowestWin = game.gameDuration;
                        }
                    }
                } else {
                    stats.losses++;
                }

                // Track vs human vs bot games
                if (game.isVsBot) {
                    stats.vsBotGames++;
                    if (game.winner === playerName) {
                        stats.vsBotWins++;
                    }
                } else {
                    stats.vsHumanGames++;
                    if (game.winner === playerName) {
                        stats.vsHumanWins++;
                    }
                }

                // Track guesses
                stats.totalGuesses += game.totalGuesses;
                stats.averageGuesses = stats.totalGuesses / stats.totalGames;

                // Add to recent games (keep last 10)
                stats.recentGames.unshift({
                    opponent: game.player1 === playerName ? game.player2 : game.player1,
                    winner: game.winner,
                    totalGuesses: game.totalGuesses,
                    gameDuration: game.gameDuration,
                    numberLength: game.numberLength,
                    difficulty: game.difficulty,
                    isVsBot: game.isVsBot,
                    createdAt: game.createdAt
                });

                if (stats.recentGames.length > 10) {
                    stats.recentGames.pop();
                }
            });
        });

        // Calculate win rates
        Object.values(playerStats).forEach((stats: any) => {
            stats.winRate = stats.totalGames > 0 ? (stats.wins / stats.totalGames) * 100 : 0;
        });

        // Convert to array and sort by total games
        const statsArray = Object.values(playerStats).sort((a: any, b: any) => b.totalGames - a.totalGames);

        return NextResponse.json(statsArray);
    } catch (error) {
        console.error('Error fetching player stats:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
