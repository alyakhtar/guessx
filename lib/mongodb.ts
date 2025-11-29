import mongoose from 'mongoose';

// const MONGODB_URI = 'mongodb+srv://gamex-admin:6hVNTdnEUYa6U6bo@gamex.0111rfj.mongodb.net/?appName=gamex';

// Use /dev database in development, /gamex in production
const dbName = process.env.NODE_ENV === 'development' ? 'dev' : 'gamex';
const MONGODB_URI = `mongodb://admin:6hVNTdnEUYa6U6bo@192.168.86.49:27017/${dbName}?authSource=admin`;

if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

let cached = (global as any).mongoose;

if (!cached) {
    cached = (global as any).mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
        };

        cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
            return mongoose;
        });
    }
    cached.conn = await cached.promise;
    return cached.conn;
}

export default connectToDatabase;
