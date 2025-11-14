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
    
    // Enhanced connection options for Docker/Coolify environments
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000, // 10 second timeout
      socketTimeoutMS: 45000, // 45 second socket timeout
      family: 4, // Force IPv4 to avoid DNS issues
      directConnection: false, // Allow replica set connections
      retryWrites: true,
      retryReads: true,
      maxPoolSize: 10,
      // Additional DNS resolution options for SRV connections
      srvMaxHosts: 0, // Use all available hosts
      srvServiceName: 'mongodb', // Default SRV service name
    };
    
    console.log('[MongoDB] Attempting connection...');
    cache.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongooseInstance) => {
        console.log('[MongoDB] ✅ Connected successfully');
        return mongooseInstance.connection;
      })
      .catch((error) => {
        console.error('[MongoDB] ❌ Connection failed:', error.message);
        if (error.message.includes('ESERVFAIL')) {
          console.error('[MongoDB] DNS resolution failed. Check:');
          console.error('  1. Docker DNS configuration');
          console.error('  2. Use standard connection string (mongodb:// instead of mongodb+srv://)');
          console.error('  3. Verify network allows DNS queries');
        }
        throw error;
      });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}


// Alias for compatibility
export { connect as connectToDatabase };
