import { describe, expect, it, vi } from 'vitest';

import {
  createSocketIdentityResolver,
  sessionTokenFromCookieHeader,
} from './socket-auth.js';

const USER_ID = '64b64c4fd6d7e7d6f7d6e001';

describe('Socket.IO Auth.js session identity', () => {
  it('prefers secure Auth.js session cookies and decodes the token once', () => {
    expect(sessionTokenFromCookieHeader(
      'theme=dark; authjs.session-token=fallback; __Secure-authjs.session-token=session%2Ftoken',
    )).toBe('session/token');
  });

  it('derives an account identity only from a verified database session', async () => {
    const findUserIdBySessionToken = vi.fn().mockResolvedValue(USER_ID);
    const resolveSocketIdentity = createSocketIdentityResolver({ findUserIdBySessionToken });

    await expect(resolveSocketIdentity({
      handshake: { headers: { cookie: '__Secure-authjs.session-token=verified-session' } },
    })).resolves.toEqual({ kind: 'account', userId: USER_ID });

    expect(findUserIdBySessionToken).toHaveBeenCalledWith('verified-session');
  });

  it('keeps absent, invalid, expired, malformed, and failed session lookups guest-scoped', async () => {
    const resolveSocketIdentity = createSocketIdentityResolver({
      findUserIdBySessionToken: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('not-an-object-id')
        .mockRejectedValueOnce(new Error('database unavailable')),
    });

    await expect(resolveSocketIdentity({ handshake: { headers: {} } })).resolves.toEqual({ kind: 'guest' });
    await expect(resolveSocketIdentity({ handshake: { headers: { cookie: 'authjs.session-token=expired' } } }))
      .resolves.toEqual({ kind: 'guest' });
    await expect(resolveSocketIdentity({ handshake: { headers: { cookie: 'authjs.session-token=malformed' } } }))
      .resolves.toEqual({ kind: 'guest' });
    await expect(resolveSocketIdentity({ handshake: { headers: { cookie: 'authjs.session-token=unavailable' } } }))
      .resolves.toEqual({ kind: 'guest' });
  });
});
