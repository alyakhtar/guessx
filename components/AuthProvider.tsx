'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import type { Session } from 'next-auth';

import { applyAuthenticatedPlayerName, PLAYER_NAME_UPDATED_EVENT } from '../lib/auth/playerName';

const AuthAvailableContext = createContext(false);

export function useApplicationAuthAvailable() {
  return useContext(AuthAvailableContext);
}

function AuthenticatedPlayerNameSynchronizer() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id || !session.user.name) return;
    const name = applyAuthenticatedPlayerName(window.localStorage, session.user.id, session.user.name);
    if (name) window.dispatchEvent(new Event(PLAYER_NAME_UPDATED_EVENT));
  }, [session?.user?.id, session?.user?.name, status]);

  return null;
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
  return available ? (
    <SessionProvider session={session}>
      <AuthenticatedPlayerNameSynchronizer />
      {content}
    </SessionProvider>
  ) : content;
}
