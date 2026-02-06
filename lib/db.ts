/**
 * Database connection module using Node.js built-in sqlite module
 * This ensures data persistence across server restarts
 */
import { DatabaseSync } from "node:sqlite";
import { join } from "path";

const DB_PATH = process.env.DATABASE_URL?.replace("file:", "") ||
  join(process.cwd(), "data", "app.db");

// Ensure data directory exists
import { mkdirSync } from "fs";
const dataDir = join(process.cwd(), "data");
try {
  mkdirSync(dataDir, { recursive: true });
} catch {
  // Directory already exists
}

// Global database instance for connection reuse
let db: DatabaseSync | null = null;

/**
 * Get or create the database connection
 * Uses singleton pattern to reuse connection across requests
 */
export function getDb(): DatabaseSync {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    // Enable foreign keys
    db.exec("PRAGMA foreign_keys = ON");
  }
  return db;
}

/**
 * Close the database connection
 * Used for cleanup during server shutdown
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Initialize database schema
 * Creates all required tables if they don't exist
 */
export function initSchema(): void {
  const database = getDb();

  // Users table for authentication
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email_verified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sessions table for session management
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)
  `);

  // User profiles table
  database.exec(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      business_name TEXT,
      logo_url TEXT,
      phone TEXT,
      address TEXT,
      tax_id TEXT,
      default_currency TEXT DEFAULT 'ILS',
      preferred_pdf_template TEXT DEFAULT 'modern',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Clients table
  database.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      contact_name TEXT,
      email TEXT,
      phone TEXT,
      default_rate REAL,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create index on clients.user_id
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id)
  `);

  // Projects table
  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      pricing_model TEXT DEFAULT 'hourly' CHECK (pricing_model IN ('hourly', 'package', 'mixed')),
      hourly_rate REAL,
      package_price REAL,
      package_hours REAL,
      overage_rate REAL,
      currency TEXT DEFAULT 'ILS',
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
      start_date DATE,
      end_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    )
  `);

  // Create indexes on projects
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)
  `);
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id)
  `);

  // Time entries table
  database.exec(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      description TEXT NOT NULL,
      start_time DATETIME,
      end_time DATETIME,
      duration INTEGER DEFAULT 0,
      date DATE NOT NULL,
      tags TEXT DEFAULT '[]',
      notes TEXT,
      is_billable INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Create indexes on time_entries
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id)
  `);
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id)
  `);
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date)
  `);

  // Rate overrides table
  database.exec(`
    CREATE TABLE IF NOT EXISTS rate_overrides (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      rate REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, tag)
    )
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_rate_overrides_project_id ON rate_overrides(project_id)
  `);

  // Custom tags table
  database.exec(`
    CREATE TABLE IF NOT EXISTS custom_tags (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_custom_tags_user_id ON custom_tags(user_id)
  `);

  // Insert default tags if they don't exist
  const defaultTags = [
    { name: "פיתוח", color: "#3b82f6" },
    { name: "ייעוץ", color: "#8b5cf6" },
    { name: "תמיכה", color: "#10b981" },
    { name: "ניהול", color: "#f59e0b" },
    { name: "אחר", color: "#6b7280" },
  ];

  const stmt = database.prepare(`
    INSERT OR IGNORE INTO custom_tags (id, user_id, name, color, is_default)
    VALUES (lower(hex(randomblob(16))), 'system', ?, ?, 1)
  `);

  for (const tag of defaultTags) {
    stmt.run(tag.name, tag.color);
  }
}

// Initialize schema on module load
initSchema();
