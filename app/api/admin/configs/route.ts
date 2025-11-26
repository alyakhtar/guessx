import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '../../../../lib/mongodb';
import DifficultyConfigModel from '../../../../lib/models/DifficultyConfig.model';

export async function GET(request: Request) {
    try {
        // Only log API calls in development mode
        if (process.env.NODE_ENV !== 'production') {
            console.log('🚀 API GET route called for /api/admin/configs');
        }
        await connectToDatabase();

        const configs: any[] = await (DifficultyConfigModel as any).find({}).lean();
        const result: any = {};

        // Create a map of all configs by difficulty_numberLength
        configs.forEach(config => {
            const key = `${config.difficulty}_${config.numberLength}`;
            result[key] = config;
        });

        // Provide defaults for common lengths (3, 4, 5, 6 digits)
        [3, 4, 5, 6].forEach(length => {
            ['easy', 'medium', 'hard'].forEach(difficulty => {
                const key = `${difficulty}_${length}`;
                if (!result[key]) {
                    result[key] = {
                        difficulty,
                        numberLength: length,
                        minGuesses: getDefaultMinGuesses(difficulty, length),
                        maxGuesses: getDefaultMaxGuesses(difficulty, length),
                    };
                }
            });
        });
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching configs:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

function getDefaultMinGuesses(difficulty: string, numberLength: number): number {
    switch (difficulty) {
        case 'easy': return numberLength * 3;
        case 'medium': return numberLength * 2;
        case 'hard': return numberLength + 2;
        default: return numberLength * 3;
    }
}

function getDefaultMaxGuesses(difficulty: string, numberLength: number): number {
    switch (difficulty) {
        case 'easy': return numberLength * 4;
        case 'medium': return numberLength * 3;
        case 'hard': return numberLength + 4;
        default: return numberLength * 4;
    }
}

export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();

        const body = await request.json();
        const { configs } = body;

        if (process.env.NODE_ENV !== 'production') {
            console.log('💾 Received configs to save:', configs);
        }

        // Update or create each config (now keyed by difficulty_numberLength)
        const updatePromises = Object.entries(configs).map(async ([key, configData]: [string, any]) => {
            if (configData) {
                // Check if this is a composite key and extract difficulty/numberLength
                let query;
                if (key.includes('_')) {
                    // New format: easy_4
                    const [difficulty, numberLength] = key.split('_');
                    query = { difficulty, numberLength: parseInt(numberLength) };
                } else {
                    // Old format: easy
                    query = { difficulty: key };
                }

                if (process.env.NODE_ENV !== 'production') {
                    console.log(`🔧 Updating config for ${key}:`, configData);
                }
                return (DifficultyConfigModel as any).findOneAndUpdate(
                    query,
                    configData,
                    { upsert: true, new: true, runValidators: true }
                );
            }
        });

        await Promise.all(updatePromises);
        if (process.env.NODE_ENV !== 'production') {
            console.log('✅ All configs updated successfully');
        }

        return NextResponse.json({ message: 'Configs updated successfully' });
    } catch (error) {
        console.error('❌ Error updating configs:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
