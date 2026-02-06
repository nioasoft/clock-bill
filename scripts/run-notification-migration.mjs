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

// Create a new pool instance
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'clockbill',
  user: 'clockbill',
  password: 'clockbill_dev',
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

    console.log('✓ Migration completed successfully!');
    console.log('  - Added bank details columns');
    console.log('  - Added PDF color columns');
    console.log('  - Added notification settings columns');
    console.log('  - long_timer_enabled: BOOLEAN DEFAULT TRUE');
    console.log('  - long_timer_threshold: INTEGER DEFAULT 120 (minutes)');
    console.log('  - daily_reminder_enabled: BOOLEAN DEFAULT FALSE');
    console.log('  - daily_reminder_time: TEXT DEFAULT 09:00');
    console.log('  - last_reminder_date: DATE');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
