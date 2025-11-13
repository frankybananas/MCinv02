import mongoose, { Connection } from 'mongoose';

type MongooseCache = {
  conn: Connection | null;
  promise: Promise<Connection> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

function getCache(): MongooseCache {
  if (!globalThis.mongooseCache) {
    globalThis.mongooseCache = { conn: null, promise: null };
  }
  return globalThis.mongooseCache;
}

/**
 * Database connection function
 */
export async function connect(): Promise<Connection> {
  const cache = getCache();
  if (cache.conn) {
    return cache.conn;
  }
  if (!cache.promise) {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('Missing MONGODB_URI. Please set it in your environment (e.g., .env.local).');
    }
    const opts = {
      bufferCommands: false,
    };
    cache.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => mongooseInstance.connection);
  }
  cache.conn = await cache.promise;
  return cache.conn;
}


// Alias for compatibility
export { connect as connectToDatabase };
