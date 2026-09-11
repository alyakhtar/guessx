import { describe, expect, it, vi } from 'vitest';

import { ensureIdentityIndexes } from './ensure-identity-indexes.mjs';

describe('ensureIdentityIndexes', () => {
  it('creates the documented lookup and provider-identity indexes', async () => {
    const users = { createIndex: vi.fn().mockResolvedValue('email_lookup') };
    const accounts = { createIndex: vi.fn().mockResolvedValue('provider_subject_unique') };
    const gameResults = { createIndex: vi.fn().mockResolvedValue('player1_account_history') };
    const db = {
      collection: vi.fn((name) => {
        if (name === 'users') return users;
        if (name === 'accounts') return accounts;
        return gameResults;
      }),
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
    expect(gameResults.createIndex).toHaveBeenCalledWith(
      { winnerUserId: 1, createdAt: -1 },
      { name: 'winner_account_results' },
    );
    expect(gameResults.createIndex).toHaveBeenCalledWith(
      { identityVersion: 1, createdAt: -1 },
      { name: 'identity_migration_status' },
    );
  });
});
