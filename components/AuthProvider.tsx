'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';

const AuthAvailableContext = createContext(false);

export function useApplicationAuthAvailable() {
  return useContext(AuthAvailableContext);
}

export default function AuthProvider({
  available,
  session,
  children,
}: {
  available: boolean;
  session: Session | null;
  children: ReactNode;
}) {
  const content = <AuthAvailableContext.Provider value={available}>{children}</AuthAvailableContext.Provider>;
  return available ? <SessionProvider session={session}>{content}</SessionProvider> : content;
}
