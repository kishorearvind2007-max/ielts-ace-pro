import mongoose from 'mongoose';
import dns from 'node:dns';

const TEMPLATE_PLACEHOLDER_PATTERN = /<[^>]+>/;

function hasTemplatePlaceholder(value: string): boolean {
  return TEMPLATE_PLACEHOLDER_PATTERN.test(value);
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
};

const cached = globalForMongoose.mongooseCache ?? {
  conn: null,
  promise: null,
};

globalForMongoose.mongooseCache = cached;

let dnsConfigured = false;

function configureMongoDns(): void {
  if (dnsConfigured) {
    return;
  }

  const configuredServers = process.env.MONGODB_DNS_SERVERS;
  const shouldOverrideDns = Boolean(configuredServers) || process.env.NODE_ENV !== 'production';
  if (!shouldOverrideDns) {
    dnsConfigured = true;
    return;
  }

  const fallbackServers = ['8.8.8.8', '1.1.1.1'];
  const servers = (configuredServers ? configuredServers.split(',') : fallbackServers)
    .map((server) => server.trim())
    .filter(Boolean);

  if (servers.length === 0) {
    dnsConfigured = true;
    return;
  }

  try {
    dns.setServers(servers);
  } catch {
    // Keep OS defaults if custom DNS servers are invalid.
  }

  dnsConfigured = true;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI in environment variables.');
  }

  if (hasTemplatePlaceholder(mongoUri)) {
    throw new Error('Invalid MONGODB_URI in environment variables. Replace placeholder values with real credentials.');
  }

  configureMongoDns();

  if (!cached.promise) {
    const dbName = process.env.MONGODB_DB_NAME;

    if (dbName && hasTemplatePlaceholder(dbName)) {
      throw new Error('Invalid MONGODB_DB_NAME in environment variables. Replace placeholder values with a real database name.');
    }

    cached.promise = mongoose
      .connect(mongoUri, {
        dbName: dbName || undefined,
      })
      .catch((error) => {
        cached.promise = null;
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}