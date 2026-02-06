import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const sqliteUrl = process.env.DATABASE_URL || './sqlite.db';

async function migrate() {
  console.log('Connecting to database...');
  const sqlite = new Database(sqliteUrl);
  sqlite.pragma('journal_mode = WAL');

  const db = drizzle(sqlite, { schema });

  console.log('Running migrations...');

  // Create tables manually since we're using SQLite
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      business_name TEXT,
      logo_url TEXT,
      phone TEXT,
      address TEXT,
      tax_id TEXT,
      default_currency TEXT DEFAULT 'ILS' NOT NULL,
      preferred_pdf_template TEXT DEFAULT 'modern' NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      contact_name TEXT,
      email TEXT,
      phone TEXT,
      default_rate REAL,
      notes TEXT,
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      pricing_model TEXT NOT NULL,
      hourly_rate REAL,
      package_price REAL,
      package_hours REAL,
      overage_rate REAL,
      currency TEXT DEFAULT 'ILS' NOT NULL,
      status TEXT DEFAULT 'active' NOT NULL,
      start_date INTEGER,
      end_date INTEGER,
      notes TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);

    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      description TEXT NOT NULL,
      start_time INTEGER,
      end_time INTEGER,
      duration INTEGER NOT NULL,
      date INTEGER NOT NULL,
      tags TEXT DEFAULT '[]',
      notes TEXT,
      is_billable INTEGER DEFAULT 1 NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id);
    CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);

    CREATE TABLE IF NOT EXISTS rate_overrides (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      rate REAL NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_rate_overrides_project_id ON rate_overrides(project_id);

    CREATE TABLE IF NOT EXISTS custom_tags (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT,
      is_default INTEGER DEFAULT 0 NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_custom_tags_user_id ON custom_tags(user_id);
  `);

  console.log('Migrations completed successfully!');
  sqlite.close();
}

migrate().catch(console.error);
