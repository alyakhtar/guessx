import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

const ACCESS_ASSERTION_HEADER = 'cf-access-jwt-assertion';
const jwksByTeamDomain = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export type AdminIdentity = {
    email: string;
    subject?: string;
};

export type AdminAuthResult =
    | { ok: true; identity: AdminIdentity }
    | { ok: false; status: 401 | 403 | 503; reason: string };

export type AdminSession = {
    user?: {
        id?: string;
        email?: string | null;
    } | null;
} | null;

function getAllowedEmails() {
    // CF_ACCESS_ALLOWED_EMAILS is preserved for existing deployments. New
    // deployments should use the provider-neutral ADMIN_ALLOWED_EMAILS name.
    const configuredEmails = process.env.ADMIN_ALLOWED_EMAILS?.trim()
        || process.env.CF_ACCESS_ALLOWED_EMAILS
        || '';
    return configuredEmails
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
}

export function isAdminEmail(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    return getAllowedEmails().includes(value.trim().toLowerCase());
}

function getAccessConfig() {
    const teamDomain = process.env.CF_ACCESS_TEAM_DOMAIN?.trim().replace(/\/$/, '');
    const audiences = (process.env.CF_ACCESS_AUDIENCE ?? '')
        .split(',')
        .map((audience) => audience.trim())
        .filter(Boolean);
    const allowedEmails = getAllowedEmails();

    if (!teamDomain || audiences.length === 0 || allowedEmails.length === 0) return null;
    return { teamDomain, audiences, allowedEmails };
}

function getJwks(teamDomain: string): ReturnType<typeof createRemoteJWKSet> {
    const existing = jwksByTeamDomain.get(teamDomain);
    if (existing) return existing;

    const jwks = createRemoteJWKSet(
        new URL(`${teamDomain}/cdn-cgi/access/certs`),
    );
    jwksByTeamDomain.set(teamDomain, jwks);
    return jwks;
}

function getEmail(payload: JWTPayload): string | null {
    return typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : null;
}

export async function authorizeAdminHeaders(headers: Headers): Promise<AdminAuthResult> {
    const config = getAccessConfig();
    if (!config) {
        return { ok: false, status: 503, reason: 'Admin authentication is not configured' };
    }

    const assertion = headers.get(ACCESS_ASSERTION_HEADER);
    if (!assertion) {
        return { ok: false, status: 401, reason: 'Missing Cloudflare Access assertion' };
    }

    try {
        const { payload } = await jwtVerify(assertion, getJwks(config.teamDomain), {
            issuer: config.teamDomain,
            audience: config.audiences,
        });
        const email = getEmail(payload);

        if (!email || !config.allowedEmails.includes(email)) {
            return { ok: false, status: 403, reason: 'Authenticated identity is not an administrator' };
        }

        return {
            ok: true,
            identity: {
                email,
                subject: typeof payload.sub === 'string' ? payload.sub : undefined,
            },
        };
    } catch {
        return { ok: false, status: 401, reason: 'Invalid Cloudflare Access assertion' };
    }
}

export function authorizeAdminSession(session: AdminSession): AdminAuthResult {
    const email = session?.user?.email?.trim().toLowerCase();
    const userId = session?.user?.id;

    if (!userId || !email) {
        return { ok: false, status: 401, reason: 'Missing GuessX application session' };
    }
    if (!isAdminEmail(email)) {
        return { ok: false, status: 403, reason: 'Authenticated identity is not an administrator' };
    }
    return { ok: true, identity: { email, subject: userId } };
}

export async function authorizeAdmin(headers: Headers, session: AdminSession): Promise<AdminAuthResult> {
    const accessAuthorization = await authorizeAdminHeaders(headers);
    if (!accessAuthorization.ok) return accessAuthorization;

    const sessionAuthorization = authorizeAdminSession(session);
    if (!sessionAuthorization.ok) return sessionAuthorization;

    // A valid admin session and a valid Access JWT are not interchangeable:
    // bind the two independent authentication layers to the same person.
    if (accessAuthorization.identity.email !== sessionAuthorization.identity.email) {
        return { ok: false, status: 403, reason: 'Admin identities do not match' };
    }
    return sessionAuthorization;
}
