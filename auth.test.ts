import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', () => ({
  default: vi.fn(() => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

async function loadAuthConfig(environment: Record<string, string | undefined>) {
  vi.resetModules();
  vi.stubEnv('AUTH_GOOGLE_ID', environment.AUTH_GOOGLE_ID ?? '');
  vi.stubEnv('AUTH_GOOGLE_SECRET', environment.AUTH_GOOGLE_SECRET ?? '');
  vi.stubEnv('AUTH_SECRET', environment.AUTH_SECRET ?? '');
  vi.stubEnv('ADMIN_ALLOWED_EMAILS', environment.ADMIN_ALLOWED_EMAILS ?? '');
  vi.stubEnv('CF_ACCESS_ALLOWED_EMAILS', environment.CF_ACCESS_ALLOWED_EMAILS ?? '');
  return import('./auth');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Auth.js configuration', () => {
  it('uses revocable database sessions for a configured Google provider', async () => {
    const { authConfig } = await loadAuthConfig({
      AUTH_GOOGLE_ID: 'google-client-id',
      AUTH_GOOGLE_SECRET: 'google-client-secret',
      AUTH_SECRET: 'application-session-secret',
    });

    expect(authConfig.session.strategy).toBe('database');
    expect(authConfig.providers).toHaveLength(1);
  });

  it('does not configure a provider when secrets are absent, leaving guests unblocked', async () => {
    const { authConfig } = await loadAuthConfig({});

    expect(authConfig.providers).toEqual([]);
  });

  it('exposes the server-derived admin flag only for allowlisted sessions', async () => {
    const { authConfig } = await loadAuthConfig({ ADMIN_ALLOWED_EMAILS: 'admin@example.com' });
    const callback = authConfig.callbacks.session!;
    const session = { user: { name: 'Admin', email: 'admin@example.com' } };

    await callback({ session, user: { id: 'user-1', name: 'Admin', email: 'ADMIN@EXAMPLE.COM' } } as never);

    expect(session.user).toMatchObject({ id: 'user-1', name: 'Admin', isAdmin: true });
  });
});
