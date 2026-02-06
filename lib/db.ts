/**
 * Database connection module using pg (PostgreSQL)
 * Connects to PostgreSQL via connection pool for concurrent request handling
 */
import { Pool, QueryResult } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://clockbill:clockbill_dev@localhost:5432/clockbill";

let pool: Pool | null = null;

/**
 * Get or create the connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

/**
 * Execute a parameterized query against the database
 * Uses $1, $2, etc. for placeholders
 */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const client = getPool();
  return client.query<T>(text, params);
}

/**
 * Close the connection pool
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Initialize database schema
 * Creates all required tables if they don't exist
 */
export async function initSchema(): Promise<void> {
  const client = getPool();

  // Users table for authentication
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Sessions table for session management
  await client.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)
  `);

  // User profiles table
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      business_name TEXT,
      logo_url TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      tax_id TEXT,
      website TEXT,
      default_currency TEXT DEFAULT 'ILS',
      preferred_pdf_template TEXT DEFAULT 'modern',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Add website column if it doesn't exist (for migrations)
  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS website TEXT
    `);
  } catch (error) {
    // Column might already exist, ignore error
    console.log("Website column migration check complete");
  }

  // Add email column if it doesn't exist (for migrations)
  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email TEXT
    `);
  } catch (error) {
    // Column might already exist, ignore error
    console.log("Email column migration check complete");
  }

  // Clients table
  await client.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      contact_name TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      default_rate REAL,
      notes TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id)
  `);

  // Add address column if it doesn't exist (for migrations)
  try {
    await client.query(`
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS address TEXT
    `);
  } catch (error) {
    // Column might already exist, ignore error
    console.log("Address column migration check complete");
  }

  // Projects table
  await client.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      pricing_model TEXT DEFAULT 'hourly' CHECK (pricing_model IN ('hourly', 'package', 'mixed', 'fixed', 'retainer')),
      hourly_rate REAL,
      package_price REAL,
      package_hours REAL,
      overage_rate REAL,
      fixed_budget REAL,
      retainer_monthly_fee REAL,
      retainer_hours REAL,
      currency TEXT DEFAULT 'ILS',
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'archived')),
      start_date DATE,
      end_date DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id)
  `);

  // Add fixed_budget column if it doesn't exist (for migrations)
  try {
    await client.query(`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS fixed_budget REAL
    `);
  } catch (error) {
    // Column might already exist, ignore error
    console.log("fixed_budget column migration check complete");
  }

  // Add retainer_monthly_fee column if it doesn't exist (for migrations)
  try {
    await client.query(`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS retainer_monthly_fee REAL
    `);
  } catch (error) {
    // Column might already exist, ignore error
    console.log("retainer_monthly_fee column migration check complete");
  }

  // Add retainer_hours column if it doesn't exist (for migrations)
  try {
    await client.query(`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS retainer_hours REAL
    `);
  } catch (error) {
    // Column might already exist, ignore error
    console.log("retainer_hours column migration check complete");
  }

  // Add 'archived' to status CHECK constraint if it doesn't exist (for migrations)
  try {
    // Drop the old check constraint and add a new one with 'archived'
    await client.query(`
      ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check
    `);
    await client.query(`
      ALTER TABLE projects ADD CONSTRAINT projects_status_check
      CHECK (status IN ('active', 'completed', 'paused', 'archived'))
    `);
  } catch (error) {
    // Constraint might already exist or other issue
    console.log("Status constraint migration check complete");
  }

  // Time entries table
  await client.query(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      description TEXT NOT NULL,
      start_time TIMESTAMP,
      end_time TIMESTAMP,
      duration INTEGER DEFAULT 0,
      date DATE NOT NULL,
      tags JSONB DEFAULT '[]',
      notes TEXT,
      is_billable BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date)
  `);

  // Add paused_at column if it doesn't exist (for pause functionality)
  try {
    await client.query(`
      ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP
    `);
  } catch (error) {
    console.log("paused_at column migration check complete");
  }

  // Add total_paused_time column if it doesn't exist (accumulated paused milliseconds)
  try {
    await client.query(`
      ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS total_paused_time INTEGER DEFAULT 0
    `);
  } catch (error) {
    console.log("total_paused_time column migration check complete");
  }

  // Rate overrides table
  await client.query(`
    CREATE TABLE IF NOT EXISTS rate_overrides (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      rate REAL NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, tag)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_rate_overrides_project_id ON rate_overrides(project_id)
  `);

  // Custom tags table
  await client.query(`
    CREATE TABLE IF NOT EXISTS custom_tags (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT,
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, name)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_custom_tags_user_id ON custom_tags(user_id)
  `);

  // Password reset tokens table
  await client.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id)
  `);

  // Insert default tags if they don't exist
  const defaultTags = [
    { name: "פיתוח", color: "#3b82f6" },
    { name: "ייעוץ", color: "#8b5cf6" },
    { name: "תמיכה", color: "#10b981" },
    { name: "ניהול", color: "#f59e0b" },
    { name: "אחר", color: "#6b7280" },
  ];

  for (const tag of defaultTags) {
    await client.query(
      `INSERT INTO custom_tags (id, user_id, name, color, is_default)
       VALUES (gen_random_uuid()::text, 'system', $1, $2, TRUE)
       ON CONFLICT DO NOTHING`,
      [tag.name, tag.color]
    );
  }
}
