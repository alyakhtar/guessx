import { PLAYER_NAME_UPDATED_EVENT } from './auth/playerName';

const GUEST_IDENTITY_STORAGE_KEY = 'guessx.guestIdentity.v1';
const PLAYER_NAME_STORAGE_KEY = 'playerName';
const AUTHENTICATED_PLAYER_NAME_USER_ID_STORAGE_KEY = 'guessx.authenticatedPlayerName.userId';
const NAME_MAX_LENGTH = 32;
const GUEST_NAME_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type GuestIdentity = {
  id: string;
  displayName: string;
};

type GuestIdentityOptions = {
  createId?: () => string;
  createName?: () => string;
};

function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().normalize('NFKC');
  if (!name || [...name].length > NAME_MAX_LENGTH ||
    /[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/u.test(name)) return null;
  return name;
}

function randomCharacter() {
  const bytes = new Uint32Array(1);
  globalThis.crypto.getRandomValues(bytes);
  return GUEST_NAME_ALPHABET[bytes[0] % GUEST_NAME_ALPHABET.length];
}

export function generateGuestName() {
  return `Guest-${Array.from({ length: 6 }, randomCharacter).join('')}`;
}

function createGuestId() {
  return globalThis.crypto.randomUUID();
}

function readGuestIdentity(storage: Pick<Storage, 'getItem'>): GuestIdentity | null {
  try {
    const raw = storage.getItem(GUEST_IDENTITY_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<GuestIdentity>;
    const displayName = normalizeDisplayName(candidate.displayName);
    return typeof candidate.id === 'string' && candidate.id && displayName
      ? { id: candidate.id, displayName }
      : null;
  } catch {
    return null;
  }
}

function persistGuestIdentity(storage: Pick<Storage, 'setItem'>, identity: GuestIdentity) {
  storage.setItem(GUEST_IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  storage.setItem(PLAYER_NAME_STORAGE_KEY, identity.displayName);
}

/**
 * Creates a browser-local guest identity without creating or impersonating an
 * authenticated GuessX user. Socket-level identity binding is deliberately
 * deferred to #63.
 */
export function getOrCreateGuestIdentity(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  options: GuestIdentityOptions = {},
): GuestIdentity {
  const existing = readGuestIdentity(storage);
  if (existing) return existing;

  const createName = options.createName ?? generateGuestName;
  const createId = options.createId ?? createGuestId;
  let storedName: string | null = null;
  let hasAuthenticatedName = false;
  try {
    storedName = storage.getItem(PLAYER_NAME_STORAGE_KEY);
    hasAuthenticatedName = Boolean(storage.getItem(AUTHENTICATED_PLAYER_NAME_USER_ID_STORAGE_KEY));
  } catch {
    // The generated identity remains usable for this page even when browser
    // storage cannot be read (for example, in restrictive private browsing).
  }
  const displayName = !hasAuthenticatedName ? normalizeDisplayName(storedName) : null;
  const identity = { id: createId(), displayName: displayName ?? createName() };

  try {
    persistGuestIdentity(storage, identity);
  } catch {
    // Storage can be unavailable in private browsing. The in-memory identity
    // still lets the visitor play; it simply cannot survive a refresh.
  }
  return identity;
}

export function generateNewGuestIdentityName(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  options: GuestIdentityOptions = {},
): GuestIdentity {
  const existing = getOrCreateGuestIdentity(storage, options);
  const identity = { ...existing, displayName: (options.createName ?? generateGuestName)() };

  try {
    persistGuestIdentity(storage, identity);
  } catch {
    // See getOrCreateGuestIdentity: lack of storage must not block guest play.
  }
  return identity;
}

export function announceGuestNameChange() {
  window.dispatchEvent(new Event(PLAYER_NAME_UPDATED_EVENT));
}
