import { MongoClient } from 'mongodb';

type MongoGlobal = typeof globalThis & {
  guessxAuthMongoClient?: MongoClient;
};

export function getAuthMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is required for application authentication');

  const globalWithMongo = global as MongoGlobal;
  if (!globalWithMongo.guessxAuthMongoClient) {
    // The MongoDB adapter connects lazily. Keeping one client per Node process
    // prevents development hot reloads from creating an unbounded pool.
    globalWithMongo.guessxAuthMongoClient = new MongoClient(uri);
  }
  return globalWithMongo.guessxAuthMongoClient;
}
