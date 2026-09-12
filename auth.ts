import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

import { GuessXMongoAdapter } from './lib/auth/adapter';
import {
  getGoogleAuthCredentials,
  isVerifiedGoogleProfile,
  safeAuthRedirect,
} from './lib/auth/config';
import { isAdminEmail } from './lib/adminAuth';

const googleCredentials = getGoogleAuthCredentials();

export const authConfig = {
  adapter: GuessXMongoAdapter(),
  trustHost: process.env.AUTH_TRUST_HOST === 'true',
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  providers: googleCredentials
    ? [Google({ clientId: googleCredentials.clientId, clientSecret: googleCredentials.clientSecret })]
    : [],
  pages: {
    error: '/login',
  },
  callbacks: {
    async signIn({ account, profile }) {
      return account?.provider === 'google' && isVerifiedGoogleProfile(profile);
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.name = user.name;
        session.user.isAdmin = isAdminEmail(user.email);
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      return safeAuthRedirect(url, baseUrl);
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
