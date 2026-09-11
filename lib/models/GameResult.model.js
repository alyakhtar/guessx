const mongoose = require('mongoose');
const { Schema, model, models } = mongoose;

const GameResultSchema = new Schema({
    // Legacy name snapshots remain populated for historical compatibility. New
    // authorization and account reporting must use the identity fields below.
    resultId: { type: String },
    player1: { type: String, required: true },
    player2: { type: String, required: true },
    winner: { type: String, required: true },
    player1DisplayName: { type: String, required: true },
    player2DisplayName: { type: String, required: true },
    player1UserId: { type: Schema.Types.ObjectId, ref: 'User' },
    player2UserId: { type: Schema.Types.ObjectId, ref: 'User' },
    winnerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    player1IdentityKind: { type: String, required: true, enum: ['account', 'guest', 'legacy-guest', 'bot'] },
    player2IdentityKind: { type: String, required: true, enum: ['account', 'guest', 'legacy-guest', 'bot'] },
    identityVersion: { type: Number, required: true, default: 1 },
    legacyIdentityMigratedAt: { type: Date },
    gameDuration: { type: Number },
    player1Guesses: { type: Number },
    player2Guesses: { type: Number },
    winnerGuesses: { type: Number },
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
GameResultSchema.index({ resultId: 1 }, { unique: true, sparse: true, name: 'result_id_unique' });
GameResultSchema.index({ player1UserId: 1, createdAt: -1 }, { name: 'player1_account_history' });
GameResultSchema.index({ player2UserId: 1, createdAt: -1 }, { name: 'player2_account_history' });
GameResultSchema.index({ winnerUserId: 1, createdAt: -1 }, { name: 'winner_account_results' });
GameResultSchema.index(
    { player1UserId: 1, player2UserId: 1, createdAt: -1 },
    { name: 'account_matchup_player1' }
);
GameResultSchema.index(
    { player2UserId: 1, player1UserId: 1, createdAt: -1 },
    { name: 'account_matchup_player2' }
);
GameResultSchema.index(
    { player1UserId: 1, player2IdentityKind: 1, player2DisplayName: 1, createdAt: -1 },
    { name: 'account_guest_matchup_player1' }
);
GameResultSchema.index(
    { player2UserId: 1, player1IdentityKind: 1, player1DisplayName: 1, createdAt: -1 },
    { name: 'account_guest_matchup_player2' }
);
GameResultSchema.index({ player1IdentityKind: 1, createdAt: -1 }, { name: 'player1_identity_reporting' });
GameResultSchema.index({ player2IdentityKind: 1, createdAt: -1 }, { name: 'player2_identity_reporting' });
GameResultSchema.index({ identityVersion: 1, createdAt: -1 }, { name: 'identity_migration_status' });

const GameResultModel = models.GameResult || model('GameResult', GameResultSchema);

module.exports = GameResultModel;
