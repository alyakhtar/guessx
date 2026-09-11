import { describe, expect, it, vi } from 'vitest';

import { legacyIdentityUpdate, migrateGameResultIdentities } from './migrate-game-result-identities.mjs';

describe('game-result identity migration', () => {
  it('classifies existing people as legacy guests and Bot as bot without fabricating identities', () => {
    expect(legacyIdentityUpdate({ player1: 'Alice', player2: 'Bot' }, new Date('2026-01-01'))).toMatchObject({
      player1DisplayName: 'Alice',
      player2DisplayName: 'Bot',
      player1IdentityKind: 'legacy-guest',
      player2IdentityKind: 'bot',
      identityVersion: 1,
    });
  });

  it('supports a non-writing dry run and an idempotent apply', async () => {
    const games = [{ _id: 'game-1', player1: 'Alice', player2: 'Bob' }];
    const collection = {
      find: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue(games) })),
      bulkWrite: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    await expect(migrateGameResultIdentities(collection)).resolves.toMatchObject({
      mode: 'dry-run', gamesChanged: 1, modified: 0, humanParticipants: 2,
    });
    expect(collection.bulkWrite).not.toHaveBeenCalled();

    await expect(migrateGameResultIdentities(collection, { apply: true })).resolves.toMatchObject({
      mode: 'apply', gamesChanged: 1, modified: 1,
    });
    expect(collection.bulkWrite).toHaveBeenCalledWith([
      expect.objectContaining({ updateOne: expect.objectContaining({ filter: { _id: 'game-1', identityVersion: { $ne: 1 } } }) }),
    ], { ordered: false });
  });

  it('rolls back only records that the migration marked', async () => {
    const collection = {
      find: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([{ _id: 'game-1', legacyIdentityMigratedAt: new Date() }]) })),
      bulkWrite: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    await expect(migrateGameResultIdentities(collection, { rollback: true })).resolves.toMatchObject({
      mode: 'rollback-dry-run', gamesChanged: 1, modified: 0,
    });
    expect(collection.bulkWrite).not.toHaveBeenCalled();

    await migrateGameResultIdentities(collection, { apply: true, rollback: true });

    expect(collection.bulkWrite).toHaveBeenCalledWith([
      expect.objectContaining({
        updateOne: expect.objectContaining({
          filter: { _id: 'game-1', legacyIdentityMigratedAt: { $exists: true } },
          update: expect.objectContaining({ $unset: expect.objectContaining({ identityVersion: '' }) }),
        }),
      }),
    ], { ordered: false });
  });
});
