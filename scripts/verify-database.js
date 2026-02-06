#!/usr/bin/env node
/**
 * Database Verification Script
 *
 * Verifies:
 * 1. Database connection works
 * 2. All required tables exist
 * 3. Tables have correct schema
 * 4. Sample queries work correctly
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://clockbill:clockbill_dev@localhost:5432/clockbill';

async function main() {
  console.log('='.repeat(60));
  console.log('DATABASE VERIFICATION');
  console.log('='.repeat(60));

  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // Test connection
    console.log('\n1. Testing database connection...');
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');

    // Check tables
    console.log('\n2. Checking database tables...');
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

    let allTablesExist = true;
    for (const tableName of requiredTables) {
      const result = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        ) as exists`,
        [tableName]
      );

      const exists = result.rows[0].exists;
      if (exists) {
        console.log(`✅ Table "${tableName}" exists`);
      } else {
        console.log(`❌ Table "${tableName}" does NOT exist`);
        allTablesExist = false;
      }
    }

    // Check critical columns
    console.log('\n3. Checking critical columns...');

    const criticalColumns = {
      users: ['id', 'email', 'password_hash', 'email_verified'],
      user_profiles: ['id', 'user_id', 'business_name', 'default_currency'],
      clients: ['id', 'user_id', 'name', 'is_active'],
      projects: ['id', 'user_id', 'client_id', 'name', 'pricing_model'],
      time_entries: ['id', 'user_id', 'project_id', 'description', 'duration'],
    };

    let allColumnsExist = true;
    for (const [table, columns] of Object.entries(criticalColumns)) {
      for (const column of columns) {
        const result = await pool.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
          ) as exists`,
          [table, column]
        );

        const exists = result.rows[0].exists;
        if (!exists) {
          console.log(`❌ Missing column "${table}.${column}"`);
          allColumnsExist = false;
        }
      }
    }

    if (allColumnsExist) {
      console.log('✅ All critical columns exist');
    }

    // Test queries
    console.log('\n4. Testing database queries...');

    const nowResult = await pool.query('SELECT NOW() as now');
    console.log(`✅ Database time: ${nowResult.rows[0].now}`);

    const uuidResult = await pool.query('SELECT gen_random_uuid()::text as id');
    console.log(`✅ UUID generation works: ${uuidResult.rows[0].id}`);

    const paramResult = await pool.query('SELECT $1::int as value', [42]);
    if (parseInt(paramResult.rows[0].value) === 42) {
      console.log('✅ Parameterized queries work correctly');
    } else {
      console.log('❌ Parameterized queries failed');
      allColumnsExist = false;
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    if (allTablesExist && allColumnsExist) {
      console.log('✅ ALL CHECKS PASSED');
      console.log('='.repeat(60));
      process.exit(0);
    } else {
      console.log('❌ SOME CHECKS FAILED');
      console.log('\nTables may need to be created. Run initSchema() from lib/db.ts');
      console.log('='.repeat(60));
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nMake sure PostgreSQL is running:');
    console.error('  docker-compose up -d');
    console.error('or');
    console.error('  docker start clockbill-db');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
