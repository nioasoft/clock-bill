import { query } from '../lib/db';

async function migrateCurrencyRates() {
  console.log('Creating currency_rates table...');

  try {
    // Create currency_rates table
    await query(`
      CREATE TABLE IF NOT EXISTS currency_rates (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        from_currency TEXT NOT NULL,
        to_currency TEXT NOT NULL,
        rate REAL NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, from_currency, to_currency)
      )
    `);

    console.log('✅ currency_rates table created successfully');

    // Grant permissions
    await query(`
      GRANT ALL PRIVILEGES ON TABLE currency_rates TO clockbill
    `);

    console.log('✅ Privileges granted on currency_rates table');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateCurrencyRates()
  .then(() => {
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
