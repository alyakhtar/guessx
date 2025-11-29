const mongoose = require('mongoose');
const { Schema, model, models } = mongoose;

const GameResultSchema = new Schema({
    player1: { type: String, required: true },
    player2: { type: String, required: true },
    winner: { type: String, required: true },
    gameDuration: { type: Number },
    totalGuesses: { type: Number, required: true },
    numberLength: { type: Number, required: true },
    difficulty: { type: String },
    isVsBot: { type: Boolean, required: true },
    createdAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Indexes for efficient queries
GameResultSchema.index({ player1: 1, createdAt: -1 });
GameResultSchema.index({ player2: 1, createdAt: -1 });
GameResultSchema.index({ winner: 1, createdAt: -1 });

const GameResultModel = models.GameResult || model('GameResult', GameResultSchema);

module.exports = GameResultModel;
