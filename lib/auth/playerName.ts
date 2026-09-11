const PLAYER_NAME_STORAGE_KEY = 'playerName';
const AUTHENTICATED_PLAYER_NAME_USER_ID_STORAGE_KEY = 'guessx.authenticatedPlayerName.userId';
const NAME_MAX_LENGTH = 32;

export const PLAYER_NAME_UPDATED_EVENT = 'guessx:player-name-updated';

function normalizeAuthenticatedPlayerName(value: string): string | null {
  const name = value.trim().normalize('NFKC');
  if (!name || [...name].length > NAME_MAX_LENGTH ||
    /[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/u.test(name)) return null;
  return name;
}

/**
 * Uses an authenticated profile name as the initial in-game name once per
 * signed-in account on this browser. A name entered afterwards remains a
 * player choice and is never overwritten by a routine session refresh.
 */
export function applyAuthenticatedPlayerName(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  userId: string,
  displayName: string,
): string | null {
  const normalizedName = normalizeAuthenticatedPlayerName(displayName);
  if (!userId || !normalizedName) return null;

  try {
    if (storage.getItem(AUTHENTICATED_PLAYER_NAME_USER_ID_STORAGE_KEY) === userId) return null;
    storage.setItem(PLAYER_NAME_STORAGE_KEY, normalizedName);
    storage.setItem(AUTHENTICATED_PLAYER_NAME_USER_ID_STORAGE_KEY, userId);
    return normalizedName;
  } catch {
    // Private browsing or full storage should never prevent a player from
    // using GuessX or completing a sign-in.
    return null;
  }
}
