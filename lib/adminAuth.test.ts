import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('jose', () => ({
    createRemoteJWKSet: vi.fn(() => vi.fn()),
    jwtVerify: vi.fn(),
}));

import { jwtVerify } from 'jose';
import { authorizeAdmin, authorizeAdminHeaders, authorizeAdminSession, isAdminEmail } from './adminAuth';

const mockedJwtVerify = vi.mocked(jwtVerify);

describe('authorizeAdminHeaders', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('CF_ACCESS_TEAM_DOMAIN', 'https://guessx.cloudflareaccess.com');
        vi.stubEnv('CF_ACCESS_AUDIENCE', 'guessx-audience');
        vi.stubEnv('ADMIN_ALLOWED_EMAILS', '');
        vi.stubEnv('CF_ACCESS_ALLOWED_EMAILS', 'admin@example.com,second@example.com');
    });

    it('fails closed when Cloudflare Access is not configured', async () => {
        vi.stubEnv('CF_ACCESS_TEAM_DOMAIN', '');

        const result = await authorizeAdminHeaders(new Headers());

        expect(result).toEqual({
            ok: false,
            status: 503,
            reason: 'Admin authentication is not configured',
        });
        expect(mockedJwtVerify).not.toHaveBeenCalled();
    });

    it('rejects requests without an Access assertion', async () => {
        const result = await authorizeAdminHeaders(new Headers());

        expect(result).toEqual({
            ok: false,
            status: 401,
            reason: 'Missing Cloudflare Access assertion',
        });
    });

    it('rejects invalid assertions', async () => {
        mockedJwtVerify.mockRejectedValueOnce(new Error('invalid token'));

        const result = await authorizeAdminHeaders(
            new Headers({ 'Cf-Access-Jwt-Assertion': 'invalid' }),
        );

        expect(result).toEqual({
            ok: false,
            status: 401,
            reason: 'Invalid Cloudflare Access assertion',
        });
    });

    it('rejects authenticated identities outside the email allowlist', async () => {
        mockedJwtVerify.mockResolvedValueOnce({
            payload: { email: 'other@example.com', sub: 'user-1' },
            protectedHeader: { alg: 'RS256' },
        } as never);

        const result = await authorizeAdminHeaders(
            new Headers({ 'Cf-Access-Jwt-Assertion': 'valid' }),
        );

        expect(result).toEqual({
            ok: false,
            status: 403,
            reason: 'Authenticated identity is not an administrator',
        });
    });

    it('accepts an allowlisted identity case-insensitively', async () => {
        mockedJwtVerify.mockResolvedValueOnce({
            payload: { email: 'ADMIN@EXAMPLE.COM', sub: 'user-1' },
            protectedHeader: { alg: 'RS256' },
        } as never);

        const result = await authorizeAdminHeaders(
            new Headers({ 'Cf-Access-Jwt-Assertion': 'valid' }),
        );

        expect(result).toEqual({
            ok: true,
            identity: { email: 'admin@example.com', subject: 'user-1' },
        });
    });

    it('passes all configured Access audiences to JWT verification', async () => {
        vi.stubEnv('CF_ACCESS_AUDIENCE', 'ui-audience,api-audience');
        mockedJwtVerify.mockResolvedValueOnce({
            payload: { email: 'admin@example.com' },
            protectedHeader: { alg: 'RS256' },
        } as never);

        await authorizeAdminHeaders(
            new Headers({ 'Cf-Access-Jwt-Assertion': 'valid' }),
        );

        expect(mockedJwtVerify).toHaveBeenCalledWith(
            'valid',
            expect.any(Function),
            expect.objectContaining({
                issuer: 'https://guessx.cloudflareaccess.com',
                audience: ['ui-audience', 'api-audience'],
            }),
        );
    });
});

describe('GuessX application admin authorization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('CF_ACCESS_TEAM_DOMAIN', 'https://guessx.cloudflareaccess.com');
        vi.stubEnv('CF_ACCESS_AUDIENCE', 'guessx-audience');
        vi.stubEnv('ADMIN_ALLOWED_EMAILS', 'admin@example.com,second@example.com');
        vi.stubEnv('CF_ACCESS_ALLOWED_EMAILS', 'legacy@example.com');
    });

    it('recognizes only allowlisted application-session emails as administrators', () => {
        expect(authorizeAdminSession(null)).toEqual({
            ok: false, status: 401, reason: 'Missing GuessX application session',
        });
        expect(authorizeAdminSession({ user: { id: 'user-1', email: 'player@example.com' } })).toEqual({
            ok: false, status: 403, reason: 'Authenticated identity is not an administrator',
        });
        expect(authorizeAdminSession({ user: { id: 'user-1', email: 'ADMIN@EXAMPLE.COM' } })).toEqual({
            ok: true, identity: { email: 'admin@example.com', subject: 'user-1' },
        });
        expect(isAdminEmail('legacy@example.com')).toBe(false);
    });

    it('requires the Cloudflare Access and GuessX session emails to match', async () => {
        mockedJwtVerify.mockResolvedValueOnce({
            payload: { email: 'admin@example.com', sub: 'access-user-1' },
            protectedHeader: { alg: 'RS256' },
        } as never);

        const result = await authorizeAdmin(
            new Headers({ 'Cf-Access-Jwt-Assertion': 'valid' }),
            { user: { id: 'user-2', email: 'second@example.com' } },
        );

        expect(result).toEqual({ ok: false, status: 403, reason: 'Admin identities do not match' });
    });

    it('rejects an invalid or absent GuessX session even when Cloudflare Access is valid', async () => {
        mockedJwtVerify.mockResolvedValueOnce({
            payload: { email: 'admin@example.com', sub: 'access-user-1' },
            protectedHeader: { alg: 'RS256' },
        } as never);

        await expect(authorizeAdmin(
            new Headers({ 'Cf-Access-Jwt-Assertion': 'valid' }),
            null,
        )).resolves.toEqual({
            ok: false,
            status: 401,
            reason: 'Missing GuessX application session',
        });
    });

    it('allows only a matching, allowlisted Access and GuessX identity pair', async () => {
        mockedJwtVerify.mockResolvedValueOnce({
            payload: { email: 'admin@example.com', sub: 'access-user-1' },
            protectedHeader: { alg: 'RS256' },
        } as never);

        await expect(authorizeAdmin(
            new Headers({ 'Cf-Access-Jwt-Assertion': 'valid' }),
            { user: { id: 'user-1', email: 'admin@example.com' } },
        )).resolves.toEqual({
            ok: true,
            identity: { email: 'admin@example.com', subject: 'user-1' },
        });
    });
});
