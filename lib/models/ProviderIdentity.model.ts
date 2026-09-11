import mongoose, { Schema, model, models, type HydratedDocument, type Types } from 'mongoose';

export interface ProviderIdentity {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: 'oauth' | 'oidc';
  provider: string;
  providerAccountId: string;
  providerEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProviderIdentitySchema = new Schema<ProviderIdentity>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Google is an OpenID Connect provider. Keep the protocol type for Auth.js
    // compatibility, while provider + providerAccountId remains the identity key.
    type: { type: String, required: true, enum: ['oauth', 'oidc'], default: 'oauth' },
    provider: { type: String, required: true, trim: true, minlength: 1, maxlength: 64 },
    providerAccountId: { type: String, required: true, trim: true, minlength: 1, maxlength: 512 },
    providerEmail: { type: String, trim: true, lowercase: true, maxlength: 320 },
  },
  {
    collection: 'accounts',
    strict: 'throw',
    timestamps: true,
  },
);

// A provider subject identifies one GuessX user. A user may link different
// providers in the future, but never two identities from the same provider.
ProviderIdentitySchema.index(
  { provider: 1, providerAccountId: 1 },
  { unique: true, name: 'provider_subject_unique' },
);
ProviderIdentitySchema.index(
  { userId: 1, provider: 1 },
  { unique: true, name: 'user_provider_unique' },
);

const ProviderIdentityModel = (models.ProviderIdentity
  || model<ProviderIdentity>('ProviderIdentity', ProviderIdentitySchema)) as mongoose.Model<ProviderIdentity>;

export type ProviderIdentityDocument = HydratedDocument<ProviderIdentity>;
export { ProviderIdentitySchema };
export default ProviderIdentityModel;
