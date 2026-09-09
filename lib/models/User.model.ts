import mongoose, { Schema, model, models, type HydratedDocument, type Types } from 'mongoose';

export interface GuessXUser {
  _id: Types.ObjectId;
  displayName: string;
  email?: string;
  emailVerified?: Date;
  image?: string;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<GuessXUser>(
  {
    displayName: { type: String, required: true, trim: true, minlength: 1, maxlength: 32 },
    // Email is useful profile and authorization data, but the provider subject is
    // the identity key. This index is intentionally non-unique.
    email: { type: String, trim: true, lowercase: true, maxlength: 320, index: true, sparse: true },
    emailVerified: { type: Date },
    image: { type: String, trim: true, maxlength: 2048 },
    lastSeenAt: { type: Date, required: true, default: Date.now },
  },
  {
    collection: 'users',
    timestamps: true,
  },
);

const UserModel = (models.User || model<GuessXUser>('User', UserSchema)) as mongoose.Model<GuessXUser>;

export type GuessXUserDocument = HydratedDocument<GuessXUser>;
export { UserSchema };
export default UserModel;
