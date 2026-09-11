import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';

export async function ensureIdentityIndexes(db) {
  await db.collection('users').createIndex(
    { email: 1 },
    { name: 'email_lookup', sparse: true },
  );
  await db.collection('accounts').createIndex(
    { provider: 1, providerAccountId: 1 },
    { name: 'provider_subject_unique', unique: true },
  );
  await db.collection('accounts').createIndex(
    { userId: 1, provider: 1 },
    { name: 'user_provider_unique', unique: true },
  );
  const gameResults = db.collection('gameresults');
  await gameResults.createIndex(
    { player1UserId: 1, createdAt: -1 },
    { name: 'player1_account_history' },
  );
  await gameResults.createIndex(
    { player2UserId: 1, createdAt: -1 },
    { name: 'player2_account_history' },
  );
  await gameResults.createIndex(
    { winnerUserId: 1, createdAt: -1 },
    { name: 'winner_account_results' },
  );
  await gameResults.createIndex(
    { resultId: 1 },
    { name: 'result_id_unique', unique: true, sparse: true },
  );
  await gameResults.createIndex(
    { player1UserId: 1, player2UserId: 1, createdAt: -1 },
    { name: 'account_matchup_player1' },
  );
  await gameResults.createIndex(
    { player2UserId: 1, player1UserId: 1, createdAt: -1 },
    { name: 'account_matchup_player2' },
  );
  await gameResults.createIndex(
    { player1UserId: 1, player2IdentityKind: 1, player2DisplayName: 1, createdAt: -1 },
    { name: 'account_guest_matchup_player1' },
  );
  await gameResults.createIndex(
    { player2UserId: 1, player1IdentityKind: 1, player1DisplayName: 1, createdAt: -1 },
    { name: 'account_guest_matchup_player2' },
  );
  await gameResults.createIndex(
    { player1IdentityKind: 1, createdAt: -1 },
    { name: 'player1_identity_reporting' },
  );
  await gameResults.createIndex(
    { player2IdentityKind: 1, createdAt: -1 },
    { name: 'player2_identity_reporting' },
  );
  await gameResults.createIndex(
    { identityVersion: 1, createdAt: -1 },
    { name: 'identity_migration_status' },
  );
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is required');

  await mongoose.connect(uri, { bufferCommands: false });
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection was not established');
    await ensureIdentityIndexes(db);
    console.log('Identity indexes are ready');
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Failed to create identity indexes:', error);
    process.exitCode = 1;
  });
}
