import ProviderIdentityModel from '../models/ProviderIdentity.model';
import UserModel from '../models/User.model';

export interface OAuthIdentityInput {
  provider: string;
  providerAccountId: string;
  email?: string;
  emailVerified?: Date;
  image?: string;
  displayName: string;
}

export interface IdentityUserRecord {
  id: string;
  displayName: string;
  email?: string;
  emailVerified?: Date;
  image?: string;
  lastSeenAt: Date;
}

export interface ProviderIdentityRecord {
  id: string;
  userId: string;
  provider: string;
  providerAccountId: string;
  providerEmail?: string;
}

export interface IdentityStore {
  findProviderIdentity(provider: string, providerAccountId: string): Promise<ProviderIdentityRecord | null>;
  findUserById(userId: string): Promise<IdentityUserRecord | null>;
  createUser(user: Omit<IdentityUserRecord, 'id'>): Promise<IdentityUserRecord>;
  createProviderIdentity(identity: Omit<ProviderIdentityRecord, 'id'>): Promise<ProviderIdentityRecord>;
  touchUser(userId: string, at: Date): Promise<IdentityUserRecord | null>;
  updateDisplayName(userId: string, displayName: string): Promise<IdentityUserRecord | null>;
  deleteUser(userId: string): Promise<void>;
}

export interface ResolvedIdentity {
  user: IdentityUserRecord;
  providerIdentity: ProviderIdentityRecord;
  isNewUser: boolean;
}

function requiredValue(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function optionalEmail(email?: string) {
  const normalized = email?.trim().toLowerCase();
  return normalized || undefined;
}

interface MongooseUserRecord {
  _id: { toString(): string };
  displayName: string;
  email?: string | null;
  emailVerified?: Date | null;
  image?: string | null;
  lastSeenAt: Date;
}

interface MongooseProviderIdentityRecord {
  _id: { toString(): string };
  userId: { toString(): string };
  provider: string;
  providerAccountId: string;
  providerEmail?: string | null;
}

function toIdentityUserRecord(user: MongooseUserRecord): IdentityUserRecord {
  return {
    id: user._id.toString(),
    displayName: user.displayName,
    email: user.email || undefined,
    emailVerified: user.emailVerified || undefined,
    image: user.image || undefined,
    lastSeenAt: user.lastSeenAt,
  };
}

function toProviderIdentityRecord(identity: MongooseProviderIdentityRecord): ProviderIdentityRecord {
  return {
    id: identity._id.toString(),
    userId: identity.userId.toString(),
    provider: identity.provider,
    providerAccountId: identity.providerAccountId,
    providerEmail: identity.providerEmail || undefined,
  };
}

function duplicateProviderError(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 11000;
}

// This is the only persistence adapter application identity code needs. The
// Auth.js integration added in #60 calls it rather than treating profile names
// or emails as identity keys.
export const mongooseIdentityStore: IdentityStore = {
  async findProviderIdentity(provider, providerAccountId) {
    const identity = await ProviderIdentityModel.findOne({ provider, providerAccountId }).lean();
    return identity ? toProviderIdentityRecord(identity) : null;
  },

  async findUserById(userId) {
    const user = await UserModel.findById(userId).lean();
    return user ? toIdentityUserRecord(user) : null;
  },

  async createUser(user) {
    const created = await UserModel.create(user);
    return toIdentityUserRecord(created);
  },

  async createProviderIdentity(identity) {
    const created = await ProviderIdentityModel.create({ ...identity, type: 'oauth' });
    return toProviderIdentityRecord(created);
  },

  async touchUser(userId, at) {
    const user = await UserModel.findByIdAndUpdate(userId, { $set: { lastSeenAt: at } }, { new: true }).lean();
    return user ? toIdentityUserRecord(user) : null;
  },

  async updateDisplayName(userId, displayName) {
    const user = await UserModel.findByIdAndUpdate(userId, { $set: { displayName } }, { new: true }).lean();
    return user ? toIdentityUserRecord(user) : null;
  },

  async deleteUser(userId) {
    await UserModel.findByIdAndDelete(userId);
  },
};

export async function resolveOAuthIdentity(
  store: IdentityStore,
  input: OAuthIdentityInput,
  at = new Date(),
): Promise<ResolvedIdentity> {
  const provider = requiredValue(input.provider, 'provider');
  const providerAccountId = requiredValue(input.providerAccountId, 'providerAccountId');
  const existingIdentity = await store.findProviderIdentity(provider, providerAccountId);

  if (existingIdentity) {
    const user = await store.touchUser(existingIdentity.userId, at);
    if (!user) throw new Error('Provider identity references a missing user');
    return { user, providerIdentity: existingIdentity, isNewUser: false };
  }

  const user = await store.createUser({
    displayName: requiredValue(input.displayName, 'displayName'),
    email: optionalEmail(input.email),
    emailVerified: input.emailVerified,
    image: input.image?.trim() || undefined,
    lastSeenAt: at,
  });

  try {
    const providerIdentity = await store.createProviderIdentity({
      userId: user.id,
      provider,
      providerAccountId,
      providerEmail: optionalEmail(input.email),
    });
    return { user, providerIdentity, isNewUser: true };
  } catch (error) {
    // A simultaneous callback for the same provider subject may win the unique
    // index race. Remove the provisional user and resolve the authoritative map.
    if (!duplicateProviderError(error)) throw error;
    await store.deleteUser(user.id);
    const providerIdentity = await store.findProviderIdentity(provider, providerAccountId);
    if (!providerIdentity) throw error;
    const existingUser = await store.touchUser(providerIdentity.userId, at);
    if (!existingUser) throw new Error('Provider identity references a missing user');
    return { user: existingUser, providerIdentity, isNewUser: false };
  }
}

export function changeDisplayName(store: IdentityStore, userId: string, displayName: string) {
  return store.updateDisplayName(userId, requiredValue(displayName, 'displayName'));
}
