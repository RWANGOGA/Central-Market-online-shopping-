import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Connect the Neon integration or add it to the environment.');
}

const globalForDb = globalThis as unknown as { __mkPool?: Pool };

export const pool =
  globalForDb.__mkPool ?? new Pool({ connectionString, max: 5 });
if (process.env.NODE_ENV !== 'production') globalForDb.__mkPool = pool;

export const db = drizzle(pool, { schema });
export { schema };

/** Rows from a raw SQL query. Replaces libsql's db.all(). */
export async function queryRows<T>(query: Parameters<typeof db.execute>[0]): Promise<T[]> {
  const result = await db.execute(query);
  return result.rows as T[];
}
