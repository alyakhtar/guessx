import { describe, expect, it, vi } from 'vitest';

import { applyAuthenticatedPlayerName } from './playerName';

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    values,
  };
}

describe('applyAuthenticatedPlayerName', () => {
  it('replaces a pre-existing guest name on a user’s first successful login', () => {
    const storage = createStorage({ playerName: 'LoL' });

    expect(applyAuthenticatedPlayerName(storage, 'user-1', 'Aly Akhtar')).toBe('Aly Akhtar');
    expect(storage.values.get('playerName')).toBe('Aly Akhtar');
    expect(storage.values.get('guessx.authenticatedPlayerName.userId')).toBe('user-1');
  });

  it('does not overwrite a name chosen after the initial login', () => {
    const storage = createStorage({
      playerName: 'My game name',
      'guessx.authenticatedPlayerName.userId': 'user-1',
    });

    expect(applyAuthenticatedPlayerName(storage, 'user-1', 'Aly Akhtar')).toBeNull();
    expect(storage.values.get('playerName')).toBe('My game name');
  });

  it('switches the default when a different account signs in', () => {
    const storage = createStorage({
      playerName: 'Aly Akhtar',
      'guessx.authenticatedPlayerName.userId': 'user-1',
    });

    expect(applyAuthenticatedPlayerName(storage, 'user-2', 'Taylor')).toBe('Taylor');
    expect(storage.values.get('playerName')).toBe('Taylor');
  });

  it('refuses malformed profile names without changing guest state', () => {
    const storage = createStorage({ playerName: 'Guest' });

    expect(applyAuthenticatedPlayerName(storage, 'user-1', 'Bad\u0000name')).toBeNull();
    expect(storage.values.get('playerName')).toBe('Guest');
  });
});
