#!/usr/bin/env tsx
/**
 * Database Verification Script
 *
 * Verifies:
 * 1. Database connection works
 * 2. All required tables exist
 * 3. Tables have correct schema
 * 4. Sample queries work correctly
 */

import { getPool, query, initSchema, closeDb } from '../lib/db';
import { createLogger } from '../lib/logger';

const logger = createLogger('verify-database');

interface TableCheck {
  name: string;
  exists: boolean;
  columns: string[];
}

async function checkTables(): Promise<TableCheck[]> {
  const checks: TableCheck[] = [];

  const requiredTables = [
    'users',
    'sessions',
    'user_profiles',
    'clients',
    'projects',
    'time_entries',
    'rate_overrides',
    'custom_tags',
    'password_reset_tokens',
    'email_verification_tokens',
    'report_presets',
  ];

  for (const tableName of requiredTables) {
    try {
      // Check if table exists
      const existsResult = await query<{
        exists: boolean;
      }>(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        ) as exists`,
        [tableName]
      );

      const exists = existsResult.rows[0]?.exists || false;

      // Get column names if table exists
      let columns: string[] = [];
      if (exists) {
        const columnsResult = await query<{
          column_name: string;
        }>(
          `SELECT column_name
           FROM information_schema.columns
           WHERE table_schema = 'public'
           AND table_name = $1
           ORDER BY ordinal_position`,
          [tableName]
        );
        columns = columnsResult.rows.map(r => r.column_name);
      }

      checks.push({
        name: tableName,
        exists,
        columns,
      });
    } catch (error) {
      logger.error(`Error checking table ${tableName}:`, error);
      checks.push({
        name: tableName,
        exists: false,
        columns: [],
      });
    }
  }

  return checks;
}

async function verifySchema(): Promise<boolean> {
  logger.info('Checking database schema...');

  const checks = await checkTables();

  let allGood = true;
  for (const check of checks) {
    if (!check.exists) {
      logger.error(`❌ Table "${check.name}" does not exist`);
      allGood = false;
    } else {
      logger.info(`✅ Table "${check.name}" exists (${check.columns.length} columns)`);
    }
  }

  // Check critical columns for key tables
  logger.info('\nChecking critical columns...');

  // users table
  const usersTable = checks.find(c => c.name === 'users');
  if (usersTable) {
    const requiredUsersColumns = ['id', 'email', 'password_hash', 'email_verified', 'created_at', 'updated_at'];
    for (const col of requiredUsersColumns) {
      if (!usersTable.columns.includes(col)) {
        logger.error(`❌ Missing column "users.${col}"`);
        allGood = false;
      }
    }
  }

  // user_profiles table
  const profilesTable = checks.find(c => c.name === 'user_profiles');
  if (profilesTable) {
    const requiredProfileColumns = ['id', 'user_id', 'business_name', 'default_currency', 'preferred_pdf_template', 'created_at', 'updated_at'];
    for (const col of requiredProfileColumns) {
      if (!profilesTable.columns.includes(col)) {
        logger.error(`❌ Missing column "user_profiles.${col}"`);
        allGood = false;
      }
    }
  }

  // clients table
  const clientsTable = checks.find(c => c.name === 'clients');
  if (clientsTable) {
    const requiredClientColumns = ['id', 'user_id', 'name', 'is_active', 'created_at', 'updated_at'];
    for (const col of requiredClientColumns) {
      if (!clientsTable.columns.includes(col)) {
        logger.error(`❌ Missing column "clients.${col}"`);
        allGood = false;
      }
    }
  }

  // projects table
  const projectsTable = checks.find(c => c.name === 'projects');
  if (projectsTable) {
    const requiredProjectColumns = ['id', 'user_id', 'client_id', 'name', 'pricing_model', 'status', 'created_at', 'updated_at'];
    for (const col of requiredProjectColumns) {
      if (!projectsTable.columns.includes(col)) {
        logger.error(`❌ Missing column "projects.${col}"`);
        allGood = false;
      }
    }
  }

  // time_entries table
  const entriesTable = checks.find(c => c.name === 'time_entries');
  if (entriesTable) {
    const requiredEntryColumns = ['id', 'user_id', 'project_id', 'description', 'duration', 'date', 'is_billable', 'created_at', 'updated_at'];
    for (const col of requiredEntryColumns) {
      if (!entriesTable.columns.includes(col)) {
        logger.error(`❌ Missing column "time_entries.${col}"`);
        allGood = false;
      }
    }
  }

  return allGood;
}

async function verifyQueries(): Promise<boolean> {
  logger.info('\nTesting sample queries...');

  try {
    // Test 1: Simple SELECT
    const result1 = await query<{ now: string }>(`SELECT NOW() as now`);
    logger.info(`✅ Database query works. Current time: ${result1.rows[0]?.now}`);

    // Test 2: Test UUID generation
    const result2 = await query<{ id: string }>(`SELECT gen_random_uuid()::text as id`);
    logger.info(`✅ UUID generation works: ${result2.rows[0]?.id}`);

    // Test 3: Test parameterized query
    const result3 = await query<{ value: number }>(`SELECT $1::int as value`, [42]);
    if (parseInt(result3.rows[0]?.value || '0') === 42) {
      logger.info('✅ Parameterized queries work correctly');
    } else {
      logger.error('❌ Parameterized queries returned wrong value');
      return false;
    }

    return true;
  } catch (error) {
    logger.error('❌ Query test failed:', error);
    return false;
  }
}

async function main() {
  logger.info('='.repeat(60));
  logger.info('DATABASE VERIFICATION');
  logger.info('='.repeat(60));

  try {
    // Test connection
    logger.info('\n1. Testing database connection...');
    const pool = getPool();
    await pool.query('SELECT 1');
    logger.info('✅ Database connection successful');

    // Check schema
    logger.info('\n2. Verifying database schema...');
    const schemaOk = await verifySchema();

    // Test queries
    logger.info('\n3. Testing database queries...');
    const queriesOk = await verifyQueries();

    // Summary
    logger.info('\n' + '='.repeat(60));
    if (schemaOk && queriesOk) {
      logger.info('✅ ALL CHECKS PASSED');
      logger.info('='.repeat(60));
      process.exit(0);
    } else {
      logger.error('❌ SOME CHECKS FAILED');
      logger.info('You may need to run initSchema() to create missing tables');
      logger.info('='.repeat(60));
      process.exit(1);
    }
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    logger.error('\nMake sure PostgreSQL is running:');
    logger.error('  docker-compose up -d');
    logger.error('or');
    logger.error('  docker start clockbill-db');
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
