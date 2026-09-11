import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';

const IDENTITY_VERSION = 1;

function participantKind(name) {
  return name === 'Bot' ? 'bot' : 'legacy-guest';
}

export function legacyIdentityUpdate(game, migratedAt = new Date()) {
  if (game.identityVersion === IDENTITY_VERSION) return null;

  return {
    player1DisplayName: game.player1,
    player2DisplayName: game.player2,
    player1IdentityKind: participantKind(game.player1),
    player2IdentityKind: participantKind(game.player2),
    identityVersion: IDENTITY_VERSION,
    legacyIdentityMigratedAt: migratedAt,
  };
}

export async function migrateGameResultIdentities(collection, { apply = false, rollback = false, now = new Date() } = {}) {
  const filter = rollback
    ? { legacyIdentityMigratedAt: { $exists: true } }
    : { identityVersion: { $ne: IDENTITY_VERSION } };
  const games = await collection.find(filter).toArray();
  const summary = {
    mode: rollback ? apply ? 'rollback-apply' : 'rollback-dry-run' : apply ? 'apply' : 'dry-run',
    scanned: games.length,
    gamesChanged: 0,
    humanParticipants: 0,
    botParticipants: 0,
  };

  const operations = games.flatMap((game) => {
    if (rollback) {
      summary.gamesChanged += 1;
      return [{
        updateOne: {
          filter: { _id: game._id, legacyIdentityMigratedAt: { $exists: true } },
          update: {
            $unset: {
              player1DisplayName: '', player2DisplayName: '',
              player1IdentityKind: '', player2IdentityKind: '',
              identityVersion: '', legacyIdentityMigratedAt: '',
            },
          },
        },
      }];
    }

    const update = legacyIdentityUpdate(game, now);
    if (!update) return [];
    summary.gamesChanged += 1;
    [update.player1IdentityKind, update.player2IdentityKind].forEach((kind) => {
      if (kind === 'bot') summary.botParticipants += 1;
      else summary.humanParticipants += 1;
    });
    return [{
      updateOne: {
        filter: { _id: game._id, identityVersion: { $ne: IDENTITY_VERSION } },
        update: { $set: update },
      },
    }];
  });

  if (apply && operations.length) {
    const result = await collection.bulkWrite(operations, { ordered: false });
    summary.modified = result.modifiedCount;
  } else {
    summary.modified = 0;
  }

  return summary;
}

function usage() {
  console.log('Usage: node scripts/migrate-game-result-identities.mjs [--apply] [--rollback]');
  console.log('Runs as a dry run by default. Use --apply to write changes.');
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--help') || args.has('-h')) return usage();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is required');

  await mongoose.connect(uri, { bufferCommands: false });
  try {
    const database = mongoose.connection.db;
    if (!database) throw new Error('MongoDB connection was not established');
    const summary = await migrateGameResultIdentities(database.collection('gameresults'), {
      apply: args.has('--apply'),
      rollback: args.has('--rollback'),
    });
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Game-result identity migration failed:', error);
    process.exitCode = 1;
  });
}
