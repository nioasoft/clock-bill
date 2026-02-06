const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://clockbill:clockbill_dev@localhost:5432/clockbill'
});

async function testPersistence() {
  const client = await pool.connect();
  try {
    // Step 1: Create a test record
    const testId = 'test-persistence-' + Date.now();
    console.log('Step 1: Creating test record with ID:', testId);

    await client.query(
      'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)',
      [testId, `test-${testId}@example.com`, 'test-hash']
    );
    console.log('✓ Test record created');

    // Step 2: Verify record exists immediately
    const result = await client.query('SELECT * FROM users WHERE id = $1', [testId]);
    if (result.rows.length === 0) {
      throw new Error('Record not found immediately after creation');
    }
    console.log('✓ Record verified immediately after creation');

    // Step 3: Close and reconnect to simulate server restart
    console.log('\nStep 2: Simulating server restart (closing connection)...');
    client.release();
    await pool.end();

    console.log('Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Reconnecting to database...');
    const newPool = new Pool({
      connectionString: 'postgresql://clockbill:clockbill_dev@localhost:5432/clockbill'
    });
    const newClient = await newPool.connect();

    // Step 4: Verify record still exists after reconnection
    console.log('\nStep 3: Verifying record still exists after reconnection...');
    const newResult = await newClient.query('SELECT * FROM users WHERE id = $1', [testId]);
    if (newResult.rows.length === 0) {
      throw new Error('Record not found after reconnection - DATA PERSISTENCE FAILED!');
    }

    console.log('✓ Record verified after reconnection');
    console.log('\n✅ DATA PERSISTENCE TEST PASSED!');

    // Clean up
    await newClient.query('DELETE FROM users WHERE id = $1', [testId]);
    console.log('✓ Test record cleaned up');

    newClient.release();
    await newPool.end();

    return true;
  } catch (error) {
    console.error('\n❌ DATA PERSISTENCE TEST FAILED:', error.message);
    throw error;
  }
}

testPersistence()
  .then(() => {
    console.log('\n=== Feature 3: Data Persistence - PASSED ===');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n=== Feature 3: Data Persistence - FAILED ===');
    process.exit(1);
  });
