import { describe, expect, it, vi } from 'vitest';
import type { AdapterAccount } from '@auth/core/adapters';

import { GuessXMongoAdapter, providerIdentityFromAccount } from './adapter';

describe('providerIdentityFromAccount', () => {
  it('keeps only the stable provider identity when a successful OAuth callback includes tokens', () => {
    const account = {
      userId: 'user-123',
      type: 'oidc',
      provider: 'google',
      providerAccountId: 'google-subject-456',
      access_token: 'access-token-that-must-not-persist',
      refresh_token: 'refresh-token-that-must-not-persist',
      id_token: 'id-token-that-must-not-persist',
      expires_at: 1234,
    } as AdapterAccount;

    expect(providerIdentityFromAccount(account)).toEqual({
      userId: 'user-123',
      type: 'oidc',
      provider: 'google',
      providerAccountId: 'google-subject-456',
    });
  });
});

describe('GuessXMongoAdapter session behavior', () => {
  it('delegates logout to the database-session adapter', async () => {
    const deleteSession = vi.fn().mockResolvedValue(undefined);
    const adapter = GuessXMongoAdapter({ deleteSession });

    await adapter.deleteSession?.('session-token');

    expect(deleteSession).toHaveBeenCalledWith('session-token');
  });
});
