import mongoose, { Schema, model, models } from 'mongoose';
import { DifficultyConfig } from '../../types/config';

const DifficultyConfigSchema = new Schema<DifficultyConfig>({
    difficulty: { type: String, required: true, enum: ['easy', 'medium', 'hard'] },
    minGuesses: { type: Number, required: true },
    maxGuesses: { type: Number, required: true },
    numberLength: { type: Number, required: true },
}, {});

// Use models.DifficultyConfig || model to prevent redefining
const DifficultyConfigModel = models.DifficultyConfig || model<DifficultyConfig>('DifficultyConfig', DifficultyConfigSchema);

export default DifficultyConfigModel;
