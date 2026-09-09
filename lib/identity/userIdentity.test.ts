import { describe, expect, it } from 'vitest';

import { ProviderIdentitySchema } from '../models/ProviderIdentity.model';
import { UserSchema } from '../models/User.model';
import {
  changeDisplayName,
  resolveOAuthIdentity,
  type IdentityStore,
  type IdentityUserRecord,
  type ProviderIdentityRecord,
} from './userIdentity';

class MemoryIdentityStore implements IdentityStore {
  users = new Map<string, IdentityUserRecord>();
  identities = new Map<string, ProviderIdentityRecord>();
  nextUserId = 1;
  nextIdentityId = 1;

  async findProviderIdentity(provider: string, providerAccountId: string) {
    return this.identities.get(`${provider}:${providerAccountId}`) ?? null;
  }

  async findUserById(userId: string) {
    return this.users.get(userId) ?? null;
  }

  async createUser(user: Omit<IdentityUserRecord, 'id'>) {
    const record = { ...user, id: `user-${this.nextUserId++}` };
    this.users.set(record.id, record);
    return record;
  }

  async createProviderIdentity(identity: Omit<ProviderIdentityRecord, 'id'>) {
    const key = `${identity.provider}:${identity.providerAccountId}`;
    if (this.identities.has(key)) {
      const error = Object.assign(new Error('duplicate provider identity'), { code: 11000 });
      throw error;
    }
    const record = { ...identity, id: `identity-${this.nextIdentityId++}` };
    this.identities.set(key, record);
    return record;
  }

  async touchUser(userId: string, at: Date) {
    const user = this.users.get(userId);
    if (!user) return null;
    const updated = { ...user, lastSeenAt: at };
    this.users.set(userId, updated);
    return updated;
  }

  async updateDisplayName(userId: string, displayName: string) {
    const user = this.users.get(userId);
    if (!user) return null;
    const updated = { ...user, displayName };
    this.users.set(userId, updated);
    return updated;
  }

  async deleteUser(userId: string) {
    this.users.delete(userId);
  }
}

describe('identity persistence', () => {
  it('creates a stable user and Google provider mapping on first login', async () => {
    const store = new MemoryIdentityStore();
    const resolved = await resolveOAuthIdentity(store, {
      provider: 'google',
      providerAccountId: 'google-subject-123',
      displayName: 'Aly',
      email: 'ALY@example.com',
    }, new Date('2026-09-08T12:00:00.000Z'));

    expect(resolved).toMatchObject({
      isNewUser: true,
      user: { id: 'user-1', displayName: 'Aly', email: 'aly@example.com' },
      providerIdentity: {
        userId: 'user-1',
        provider: 'google',
        providerAccountId: 'google-subject-123',
        providerEmail: 'aly@example.com',
      },
    });
    expect(Object.keys(resolved.providerIdentity)).not.toContain('accessToken');
  });

  it('resolves a repeat login to the original user without replacing the display name', async () => {
    const store = new MemoryIdentityStore();
    const first = await resolveOAuthIdentity(store, {
      provider: 'google',
      providerAccountId: 'google-subject-123',
      displayName: 'Original name',
    });
    await changeDisplayName(store, first.user.id, 'Chosen name');

    const repeat = await resolveOAuthIdentity(store, {
      provider: 'google',
      providerAccountId: 'google-subject-123',
      displayName: 'Google profile changed',
    }, new Date('2026-09-08T12:00:00.000Z'));

    expect(repeat).toMatchObject({
      isNewUser: false,
      user: { id: first.user.id, displayName: 'Chosen name' },
    });
    expect(store.users).toHaveLength(1);
  });

  it('changes a display name without changing user or provider identity', async () => {
    const store = new MemoryIdentityStore();
    const resolved = await resolveOAuthIdentity(store, {
      provider: 'google',
      providerAccountId: 'google-subject-123',
      displayName: 'Before',
    });

    const changed = await changeDisplayName(store, resolved.user.id, 'After');

    expect(changed).toMatchObject({ id: resolved.user.id, displayName: 'After' });
    expect(await store.findProviderIdentity('google', 'google-subject-123')).toEqual(resolved.providerIdentity);
  });
});

describe('identity schemas', () => {
  it('uses a non-unique email attribute and unique provider subject mappings', () => {
    expect(UserSchema.path('email').options.unique).toBeUndefined();
    expect(UserSchema.path('email').options.index).toBe(true);
    expect(ProviderIdentitySchema.indexes()).toEqual(expect.arrayContaining([
      [{ provider: 1, providerAccountId: 1 }, expect.objectContaining({ unique: true })],
      [{ userId: 1, provider: 1 }, expect.objectContaining({ unique: true })],
    ]));
  });

  it('does not define sensitive provider token fields', () => {
    const paths = Object.keys(ProviderIdentitySchema.paths);
    [
      'access_token',
      'refresh_token',
      'id_token',
      'accessToken',
      'refreshToken',
      'idToken',
    ].forEach((field) => expect(paths).not.toContain(field));
  });
});
