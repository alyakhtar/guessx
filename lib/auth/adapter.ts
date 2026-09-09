import { MongoDBAdapter } from '@auth/mongodb-adapter';
import type { Adapter, AdapterAccount, AdapterUser } from '@auth/core/adapters';

import connectToDatabase from '../mongodb';
import ProviderIdentityModel, { type ProviderIdentity } from '../models/ProviderIdentity.model';
import UserModel, { type GuessXUser } from '../models/User.model';
import { getAuthMongoClient } from './mongodb';

function displayNameFromProfile(name: string | null | undefined, email: string) {
  const candidate = name?.trim() || email.split('@')[0] || 'Player';
  return Array.from(candidate).slice(0, 32).join('');
}

function toAdapterUser(user: Pick<GuessXUser, '_id' | 'displayName' | 'email' | 'emailVerified' | 'image'>): AdapterUser {
  return {
    id: user._id.toString(),
    name: user.displayName,
    email: user.email ?? '',
    emailVerified: user.emailVerified ?? null,
    image: user.image ?? null,
  };
}

type ProviderIdentityInput = {
  userId: string;
  type: 'oauth' | 'oidc';
  provider: string;
  providerAccountId: string;
};

function toAdapterAccount(identity: Pick<ProviderIdentity, 'userId' | 'type' | 'provider' | 'providerAccountId'>): AdapterAccount {
  return {
    userId: identity.userId.toString(),
    type: identity.type,
    provider: identity.provider,
    providerAccountId: identity.providerAccountId,
  };
}

// OAuth tokens are unnecessary after Google has authenticated a GuessX player.
// Whitelisting fields rather than deleting known token keys keeps future provider
// response fields from accidentally becoming persisted secrets.
export function providerIdentityFromAccount(account: AdapterAccount): ProviderIdentityInput {
  return {
    userId: account.userId,
    type: account.type === 'oidc' ? 'oidc' : 'oauth',
    provider: account.provider,
    providerAccountId: account.providerAccountId,
  };
}

export function GuessXMongoAdapter(
  baseAdapter: Adapter = MongoDBAdapter(() => getAuthMongoClient()),
): Adapter {

  const getUser = async (id: string) => {
    await connectToDatabase();
    const user = await UserModel.findById(id).lean();
    return user ? toAdapterUser(user) : null;
  };

  return {
    ...baseAdapter,
    async createUser(data) {
      await connectToDatabase();
      const user = await UserModel.create({
        displayName: displayNameFromProfile(data.name, data.email),
        email: data.email,
        emailVerified: data.emailVerified ?? undefined,
        image: data.image ?? undefined,
        lastSeenAt: new Date(),
      });
      return toAdapterUser(user);
    },
    getUser,
    // Never associate a provider callback with an existing GuessX account solely
    // because an email happens to match. Provider subject IDs are authoritative.
    async getUserByEmail() {
      return null;
    },
    async getUserByAccount({ provider, providerAccountId }) {
      await connectToDatabase();
      const identity = await ProviderIdentityModel.findOne({ provider, providerAccountId }).lean();
      if (!identity) return null;
      return getUser(identity.userId.toString());
    },
    async updateUser(data) {
      await connectToDatabase();
      const updates: Partial<Pick<GuessXUser, 'email' | 'emailVerified' | 'image'>> = {};
      if (data.email !== undefined) updates.email = data.email.toLowerCase();
      if (data.emailVerified !== undefined) updates.emailVerified = data.emailVerified ?? undefined;
      if (data.image !== undefined) updates.image = data.image ?? undefined;

      const user = Object.keys(updates).length
        ? await UserModel.findByIdAndUpdate(data.id, { $set: updates }, { new: true }).lean()
        : await UserModel.findById(data.id).lean();
      if (!user) throw new Error('Authenticated user was not found');
      return toAdapterUser(user);
    },
    async linkAccount(account) {
      await connectToDatabase();
      const identityInput = providerIdentityFromAccount(account);
      const existingBySubject = await ProviderIdentityModel.findOne({
        provider: identityInput.provider,
        providerAccountId: identityInput.providerAccountId,
      }).lean();

      if (existingBySubject) {
        if (existingBySubject.userId.toString() !== identityInput.userId) {
          throw new Error('Provider account is already linked to another user');
        }
        return toAdapterAccount(existingBySubject);
      }

      const existingProviderForUser = await ProviderIdentityModel.findOne({
        userId: identityInput.userId,
        provider: identityInput.provider,
      }).lean();
      if (existingProviderForUser) throw new Error('A provider identity is already linked for this user');

      const user = await UserModel.findById(identityInput.userId).lean();
      if (!user) throw new Error('Authenticated user was not found');
      const identity = await ProviderIdentityModel.create({
        ...identityInput,
        providerEmail: user.email,
      });
      return toAdapterAccount(identity);
    },
    async unlinkAccount({ provider, providerAccountId }) {
      await connectToDatabase();
      const identity = await ProviderIdentityModel.findOneAndDelete({ provider, providerAccountId }).lean();
      return identity ? toAdapterAccount(identity) : undefined;
    },
    async getAccount(providerAccountId, provider) {
      await connectToDatabase();
      const identity = await ProviderIdentityModel.findOne({ provider, providerAccountId }).lean();
      return identity ? toAdapterAccount(identity) : null;
    },
    async getSessionAndUser(sessionToken) {
      const sessionAndUser = await baseAdapter.getSessionAndUser?.(sessionToken);
      if (!sessionAndUser) return null;
      const user = await getUser(sessionAndUser.session.userId);
      return user ? { session: sessionAndUser.session, user } : null;
    },
  };
}
