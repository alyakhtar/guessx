import mongoose, { Schema, model, models, type Types } from 'mongoose';

export interface DailyChallengeAttemptDocument {
  _id: Types.ObjectId;
  challengeDate: string;
  participantKind: 'account' | 'guest';
  participantKey: string;
  userId?: Types.ObjectId;
  guesses: Array<{
    guess: string;
    correctPositions: number;
    createdAt: Date;
  }>;
  status: 'active' | 'won' | 'exhausted';
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DailyChallengeGuessSchema = new Schema(
  {
    guess: { type: String, required: true, match: /^\d{4}$/ },
    correctPositions: { type: Number, required: true, min: 0, max: 4 },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const DailyChallengeAttemptSchema = new Schema<DailyChallengeAttemptDocument>(
  {
    challengeDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    participantKind: { type: String, required: true, enum: ['account', 'guest'] },
    // Account IDs are stored separately. Guest keys are SHA-256 hashes of an
    // opaque HttpOnly cookie and never contain the raw browser identifier.
    participantKey: { type: String, required: true, maxlength: 128 },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    guesses: { type: [DailyChallengeGuessSchema], default: [] },
    status: { type: String, required: true, enum: ['active', 'won', 'exhausted'], default: 'active' },
    completedAt: { type: Date },
  },
  {
    collection: 'dailyChallengeAttempts',
    timestamps: true,
  },
);

DailyChallengeAttemptSchema.index(
  { challengeDate: 1, participantKey: 1 },
  { unique: true, name: 'daily_attempt_per_participant' },
);
DailyChallengeAttemptSchema.index({ challengeDate: 1, status: 1 }, { name: 'daily_attempt_status_reporting' });
DailyChallengeAttemptSchema.index({ userId: 1, challengeDate: -1 }, { name: 'daily_account_attempt_history', sparse: true });

const DailyChallengeAttemptModel = (models.DailyChallengeAttempt
  || model<DailyChallengeAttemptDocument>('DailyChallengeAttempt', DailyChallengeAttemptSchema)) as mongoose.Model<DailyChallengeAttemptDocument>;

export default DailyChallengeAttemptModel;
