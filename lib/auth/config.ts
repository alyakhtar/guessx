export interface GoogleAuthCredentials {
  clientId: string;
  clientSecret: string;
}

type AuthEnvironment = Record<string, string | undefined>;

export function getGoogleAuthCredentials(environment: AuthEnvironment = process.env): GoogleAuthCredentials | null {
  const clientId = environment.AUTH_GOOGLE_ID?.trim();
  const clientSecret = environment.AUTH_GOOGLE_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isApplicationAuthConfigured(environment: AuthEnvironment = process.env) {
  return Boolean(environment.AUTH_SECRET?.trim() && getGoogleAuthCredentials(environment));
}

export function safeAuthRedirect(url: string, baseUrl: string) {
  if (url.startsWith('/')) return `${baseUrl}${url}`;

  try {
    return new URL(url).origin === baseUrl ? url : baseUrl;
  } catch {
    return baseUrl;
  }
}

export function isVerifiedGoogleProfile(profile: unknown) {
  return typeof profile === 'object'
    && profile !== null
    && 'email_verified' in profile
    && (profile as { email_verified?: unknown }).email_verified === true;
}
