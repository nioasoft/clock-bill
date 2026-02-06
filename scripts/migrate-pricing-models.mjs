/**
 * Migration script to add new pricing model columns to projects table
 * Run with: node scripts/migrate-pricing-models.mjs
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://clockbill:clockbill_dev@localhost:5432/clockbill',
});

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('Starting migration: Add new pricing model columns');

    // Add fixed_budget column
    await client.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS fixed_budget REAL
    `);
    console.log('✓ Added fixed_budget column');

    // Add retainer_monthly_fee column
    await client.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS retainer_monthly_fee REAL
    `);
    console.log('✓ Added retainer_monthly_fee column');

    // Add retainer_hours column
    await client.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS retainer_hours REAL
    `);
    console.log('✓ Added retainer_hours column');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
