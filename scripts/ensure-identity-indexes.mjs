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
