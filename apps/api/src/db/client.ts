import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

const { Pool } = pg;

export type ApiDatabase = NodePgDatabase<typeof schema>;

let cachedPool: pg.Pool | null = null;
let cachedDb: ApiDatabase | null = null;

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured.');
  }

  return databaseUrl;
}

export function getPgPool(): pg.Pool {
  if (!cachedPool) {
    cachedPool = new Pool({
      connectionString: getDatabaseUrl(),
    });
  }

  return cachedPool;
}

export function getDb(): ApiDatabase {
  if (!cachedDb) {
    cachedDb = drizzle(getPgPool(), { schema });
  }

  return cachedDb;
}

export async function closeDb(): Promise<void> {
  if (cachedPool) {
    await cachedPool.end();
  }

  cachedPool = null;
  cachedDb = null;
}
