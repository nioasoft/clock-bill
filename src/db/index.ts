import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://clockbill:clockbill_dev@localhost:5432/clockbill';

let pool: Pool;
let db: ReturnType<typeof drizzle>;

export function getDb() {
  if (!db) {
    pool = new Pool({ connectionString: DATABASE_URL });
    db = drizzle(pool, { schema });
  }
  return db;
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = undefined as unknown as Pool;
    db = undefined as unknown as ReturnType<typeof drizzle>;
  }
}

export type Database = typeof db;
export { schema };
