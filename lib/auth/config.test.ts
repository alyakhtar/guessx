import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getGoogleAuthCredentials,
  isApplicationAuthConfigured,
  isVerifiedGoogleProfile,
  safeAuthRedirect,
} from './config';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Google auth configuration', () => {
  it('is enabled only with a Google client ID, client secret, and application session secret', () => {
    expect(getGoogleAuthCredentials({ AUTH_GOOGLE_ID: 'id', AUTH_GOOGLE_SECRET: 'secret' })).toEqual({
      clientId: 'id',
      clientSecret: 'secret',
    });
    expect(isApplicationAuthConfigured({
      AUTH_GOOGLE_ID: 'id',
      AUTH_GOOGLE_SECRET: 'secret',
      AUTH_SECRET: 'session-secret',
    })).toBe(true);
    expect(isApplicationAuthConfigured({ AUTH_GOOGLE_ID: 'id', AUTH_GOOGLE_SECRET: 'secret' })).toBe(false);
    expect(getGoogleAuthCredentials({ AUTH_GOOGLE_ID: 'id' })).toBeNull();
  });

  it('accepts only verified Google profiles', () => {
    expect(isVerifiedGoogleProfile({ email_verified: true })).toBe(true);
    expect(isVerifiedGoogleProfile({ email_verified: false })).toBe(false);
    expect(isVerifiedGoogleProfile({})).toBe(false);
  });
});

describe('OAuth return URLs', () => {
  const baseUrl = 'https://guessx.example.com';

  it('returns a successful login to the requested local page', () => {
    expect(safeAuthRedirect('/fr', baseUrl)).toBe('https://guessx.example.com/fr');
    expect(safeAuthRedirect('https://guessx.example.com/en/game/ROOM1', baseUrl))
      .toBe('https://guessx.example.com/en/game/ROOM1');
  });

  it('rejects malformed or cross-origin return URLs', () => {
    expect(safeAuthRedirect('https://attacker.example/login', baseUrl)).toBe(baseUrl);
    expect(safeAuthRedirect('not a URL', baseUrl)).toBe(baseUrl);
  });
});
