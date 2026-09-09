import { describe, expect, it, vi } from 'vitest';

import { ensureIdentityIndexes } from './ensure-identity-indexes.mjs';

describe('ensureIdentityIndexes', () => {
  it('creates the documented lookup and provider-identity indexes', async () => {
    const users = { createIndex: vi.fn().mockResolvedValue('email_lookup') };
    const accounts = { createIndex: vi.fn().mockResolvedValue('provider_subject_unique') };
    const db = {
      collection: vi.fn((name) => (name === 'users' ? users : accounts)),
    };

    await ensureIdentityIndexes(db);

    expect(users.createIndex).toHaveBeenCalledWith(
      { email: 1 },
      { name: 'email_lookup', sparse: true },
    );
    expect(accounts.createIndex).toHaveBeenNthCalledWith(
      1,
      { provider: 1, providerAccountId: 1 },
      { name: 'provider_subject_unique', unique: true },
    );
    expect(accounts.createIndex).toHaveBeenNthCalledWith(
      2,
      { userId: 1, provider: 1 },
      { name: 'user_provider_unique', unique: true },
    );
  });
});
