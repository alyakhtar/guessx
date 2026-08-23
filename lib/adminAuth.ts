import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

const ACCESS_ASSERTION_HEADER = 'cf-access-jwt-assertion';
const jwksByTeamDomain = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export type AdminIdentity = {
    email: string;
    subject?: string;
};

type AdminAuthResult =
    | { ok: true; identity: AdminIdentity }
    | { ok: false; status: 401 | 403 | 503; reason: string };

function getConfig() {
    const teamDomain = process.env.CF_ACCESS_TEAM_DOMAIN?.trim().replace(/\/$/, '');
    const audiences = (process.env.CF_ACCESS_AUDIENCE ?? '')
        .split(',')
        .map((audience) => audience.trim())
        .filter(Boolean);
    const allowedEmails = (process.env.CF_ACCESS_ALLOWED_EMAILS ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

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
    const config = getConfig();
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

export async function authorizeAdminRequest(request: Request): Promise<AdminAuthResult> {
    return authorizeAdminHeaders(request.headers);
}
