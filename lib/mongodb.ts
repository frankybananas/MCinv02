import mongoose, { Connection } from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections from growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

/**
 * Database connection function
 */
export async function connect(): Promise<Connection> {
  if (cached.conn) {
    return cached.conn;
  }
  if (!cached.promise) {
    if (!MONGODB_URI) {
      throw new Error('Missing MONGODB_URI. Please set it in your environment (e.g., .env.local).');
    }
    const opts = {
      bufferCommands: false,
    };
    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongoose) => {
      return mongoose.connection;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}


// Alias for compatibility
export { connect as connectToDatabase };
