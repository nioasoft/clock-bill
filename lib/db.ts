/**
 * Database connection module using pg (PostgreSQL)
 * Connects to PostgreSQL via connection pool for concurrent request handling
 */
import { Pool, PoolClient, QueryResult } from "pg";
import { getDatabaseUrl } from "./env";
import { createLogger } from "./logger";

const logger = createLogger("db");

let pool: Pool | null = null;

/**
 * Get or create the connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
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
 * Execute a callback within a database transaction.
 * Automatically handles BEGIN/COMMIT/ROLLBACK.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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

// Graceful shutdown in dev mode to prevent connection leaks on hot reload
if (process.env.NODE_ENV === "development") {
  const shutdown = () => {
    closeDb().catch(() => {});
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

/**
 * @deprecated Schema is now managed by Drizzle ORM (src/db/schema.ts).
 * Use `drizzle-kit push` or `drizzle-kit migrate` for schema changes.
 * This function is kept for backward compatibility but should not be used.
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

  // Add role column if it doesn't exist
  try {
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'
    `);
  } catch (error) {
    logger.debug("role column migration check complete");
  }

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
    logger.debug("Website column migration check complete");
  }

  // Add email column if it doesn't exist (for migrations)
  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email TEXT
    `);
  } catch (error) {
    // Column might already exist, ignore error
    logger.debug("Email column migration check complete");
  }

  // Add invoice_prefix column if it doesn't exist (for migrations)
  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS invoice_prefix TEXT
    `);
  } catch (error) {
    // Column might already exist, ignore error
    logger.debug("invoice_prefix column migration check complete");
  }

  // Add next_invoice_number column if it doesn't exist (for migrations)
  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS next_invoice_number INTEGER
    `);
  } catch (error) {
    // Column might already exist, ignore error
    logger.debug("next_invoice_number column migration check complete");
  }

  // Add payment_terms column if it doesn't exist (for migrations)
  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS payment_terms TEXT
    `);
  } catch (error) {
    // Column might already exist, ignore error
    logger.debug("payment_terms column migration check complete");
  }

  // Add bank_name column if it doesn't exist (for bank details)
  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bank_name TEXT
    `);
  } catch (error) {
    // Column might already exist, ignore error
    logger.debug("bank_name column migration check complete");
  }

  // Add bank_account_number column if it doesn't exist (for bank details)
  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bank_account_number TEXT
    `);
  } catch (error) {
    // Column might already exist, ignore error
    logger.debug("bank_account_number column migration check complete");
  }

  // Add bank_branch column if it doesn't exist (for bank details)
  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bank_branch TEXT
    `);
  } catch (error) {
    // Column might already exist, ignore error
    logger.debug("bank_branch column migration check complete");
  }

  // Add bank_swift column if it doesn't exist (for international transfers)
  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bank_swift TEXT
    `);
  } catch (error) {
    // Column might already exist, ignore error
    logger.debug("bank_swift column migration check complete");
  }

  // Add signature_url column if it doesn't exist (for digital signature)
  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS signature_url TEXT
    `);
  } catch (error) {
    // Column might already exist, ignore error
    logger.debug("signature_url column migration check complete");
  }

  // Add pdf_primary_color column if it doesn't exist (for PDF customization)
  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS pdf_primary_color TEXT DEFAULT '#2563EB'
    `);
  } catch (error) {
    // Column might already exist, ignore error
    logger.debug("pdf_primary_color column migration check complete");
  }

  // Add pdf_accent_color column if it doesn't exist (for PDF customization)
  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS pdf_accent_color TEXT DEFAULT '#059669'
    `);
  } catch (error) {
    // Column might already exist, ignore error
    logger.debug("pdf_accent_color column migration check complete");
  }

  // Add working_hours column if it doesn't exist (for daily work hours tracking)
  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS working_hours REAL DEFAULT 8
    `);
  } catch (error) {
    // Column might already exist, ignore error
    logger.debug("working_hours column migration check complete");
  }

  // Add notification settings columns if they don't exist
  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS long_timer_enabled BOOLEAN DEFAULT TRUE
    `);
  } catch (error) {
    logger.debug("long_timer_enabled column migration check complete");
  }

  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS long_timer_threshold INTEGER DEFAULT 120
    `);
  } catch (error) {
    logger.debug("long_timer_threshold column migration check complete");
  }

  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS daily_reminder_enabled BOOLEAN DEFAULT FALSE
    `);
  } catch (error) {
    logger.debug("daily_reminder_enabled column migration check complete");
  }

  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS daily_reminder_time TEXT DEFAULT '09:00'
    `);
  } catch (error) {
    logger.debug("daily_reminder_time column migration check complete");
  }

  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_reminder_date DATE
    `);
  } catch (error) {
    logger.debug("last_reminder_date column migration check complete");
  }

  // Add date_format column if it doesn't exist (for display preferences)
  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS date_format TEXT DEFAULT 'DD/MM/YYYY'
    `);
  } catch (error) {
    logger.debug("date_format column migration check complete");
  }

  // Add time_format column if it doesn't exist (for display preferences)
  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS time_format TEXT DEFAULT '24h'
    `);
  } catch (error) {
    logger.debug("time_format column migration check complete");
  }

  // Add first_day_of_week column if it doesn't exist (for calendar preferences)
  try {
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS first_day_of_week TEXT DEFAULT 'sunday'
    `);
  } catch (error) {
    logger.debug("first_day_of_week column migration check complete");
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
    logger.debug("Address column migration check complete");
  }

  // Add retainer-related columns to clients
  try {
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ILS'`);
  } catch (error) {
    logger.debug("clients.currency column migration check complete");
  }
  try {
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_retainer BOOLEAN DEFAULT FALSE`);
  } catch (error) {
    logger.debug("clients.is_retainer column migration check complete");
  }
  try {
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS retainer_hours REAL`);
  } catch (error) {
    logger.debug("clients.retainer_hours column migration check complete");
  }
  try {
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS retainer_monthly_fee REAL`);
  } catch (error) {
    logger.debug("clients.retainer_monthly_fee column migration check complete");
  }
  try {
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS overage_rate REAL`);
  } catch (error) {
    logger.debug("clients.overage_rate column migration check complete");
  }

  // Projects table (billing is determined by client, not project)
  await client.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'archived')),
      start_date DATE,
      end_date DATE,
      fixed_monthly_enabled BOOLEAN DEFAULT FALSE,
      fixed_monthly_fee REAL,
      fixed_monthly_start_date DATE,
      fixed_monthly_end_date DATE,
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
  try {
    await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS fixed_monthly_enabled BOOLEAN DEFAULT FALSE`);
  } catch (error) {
    logger.debug("projects.fixed_monthly_enabled column migration check complete");
  }
  try {
    await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS fixed_monthly_fee REAL`);
  } catch (error) {
    logger.debug("projects.fixed_monthly_fee column migration check complete");
  }
  try {
    await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS fixed_monthly_start_date DATE`);
  } catch (error) {
    logger.debug("projects.fixed_monthly_start_date column migration check complete");
  }
  try {
    await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS fixed_monthly_end_date DATE`);
  } catch (error) {
    logger.debug("projects.fixed_monthly_end_date column migration check complete");
  }

  // Tasks table (sub-items within projects)
  await client.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)
  `);

  // Time entries table
  await client.query(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      start_time TIMESTAMP,
      end_time TIMESTAMP,
      duration INTEGER DEFAULT 0,
      date DATE NOT NULL,
      tags JSONB DEFAULT '[]',
      notes TEXT,
      is_billable BOOLEAN DEFAULT TRUE,
      paused_at TIMESTAMP,
      total_paused_time INTEGER DEFAULT 0,
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
    CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON time_entries(task_id)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date)
  `);

  // Add task_id column if it doesn't exist (for migrations)
  try {
    await client.query(`
      ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL
    `);
  } catch (error) {
    logger.debug("task_id column migration check complete");
  }

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

  // Email verification tokens table
  await client.query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
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
    CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id)
  `);

  // Report presets table
  await client.query(`
    CREATE TABLE IF NOT EXISTS report_presets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      client_id TEXT,
      project_id TEXT,
      start_date DATE,
      end_date DATE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_report_presets_user_id ON report_presets(user_id)
  `);

  // Currency rates table
  await client.query(`
    CREATE TABLE IF NOT EXISTS currency_rates (
      id TEXT PRIMARY KEY,
      base_currency TEXT NOT NULL,
      target_currency TEXT NOT NULL,
      rate REAL NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(base_currency, target_currency)
    )
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
