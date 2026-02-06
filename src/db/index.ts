import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const sqliteUrl = process.env.DATABASE_URL || './sqlite.db';

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

export function getDb() {
  if (!db) {
    sqlite = new Database(sqliteUrl);
    sqlite.pragma('journal_mode = WAL');
    db = drizzle(sqlite, { schema });
  }
  return db;
}

export function closeDb() {
  if (sqlite) {
    sqlite.close();
    sqlite = undefined as unknown as Database.Database;
    db = undefined as unknown as ReturnType<typeof drizzle>;
  }
}

export type Database = typeof db;
export { schema };
