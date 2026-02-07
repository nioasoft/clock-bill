#!/usr/bin/env node

/**
 * Migration script to add notification settings to user_profiles table
 */

import pg from 'pg';
const { Pool } = pg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Starting notification settings migration...');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'add-notification-settings.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Execute the migration
    await client.query(sql);

    console.log('Migration completed successfully!');
    console.log('  - Added bank details columns');
    console.log('  - Added PDF color columns');
    console.log('  - Added notification settings columns');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
