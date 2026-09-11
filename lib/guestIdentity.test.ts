import { describe, expect, it, vi } from 'vitest';

import { generateNewGuestIdentityName, getOrCreateGuestIdentity } from './guestIdentity';

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    values,
  };
}

describe('guest browser identity', () => {
  it('creates and persists an opaque guest ID and generated display name', () => {
    const storage = createStorage();

    const identity = getOrCreateGuestIdentity(storage, {
      createId: () => 'guest-id',
      createName: () => 'Guest-ABC123',
    });

    expect(identity).toEqual({ id: 'guest-id', displayName: 'Guest-ABC123' });
    expect(storage.values.get('playerName')).toBe('Guest-ABC123');
    expect(JSON.parse(storage.values.get('guessx.guestIdentity.v1') ?? '{}')).toEqual(identity);
  });

  it('preserves a pre-existing guest display name during the migration', () => {
    const storage = createStorage({ playerName: 'LoL' });

    expect(getOrCreateGuestIdentity(storage, {
      createId: () => 'guest-id',
      createName: () => 'Guest-ABC123',
    })).toEqual({ id: 'guest-id', displayName: 'LoL' });
  });

  it('does not reuse an authenticated profile name as a guest identity', () => {
    const storage = createStorage({
      playerName: 'Aly Akhtar',
      'guessx.authenticatedPlayerName.userId': 'account-id',
    });

    expect(getOrCreateGuestIdentity(storage, {
      createId: () => 'guest-id',
      createName: () => 'Guest-ABC123',
    })).toEqual({ id: 'guest-id', displayName: 'Guest-ABC123' });
  });

  it('keeps the same guest ID when generating another name', () => {
    const storage = createStorage();
    const options = { createId: () => 'guest-id', createName: vi.fn()
      .mockReturnValueOnce('Guest-ABC123')
      .mockReturnValueOnce('Guest-DEF456') };

    getOrCreateGuestIdentity(storage, options);
    expect(generateNewGuestIdentityName(storage, options)).toEqual({ id: 'guest-id', displayName: 'Guest-DEF456' });
  });
});
