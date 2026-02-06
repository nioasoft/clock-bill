const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'app.db');
console.log('Testing database at:', DB_PATH);

// First connection - create test data
const db1 = new Database(DB_PATH);
db1.exec('PRAGMA foreign_keys = ON');
db1.exec('PRAGMA journal_mode = WAL');

// Initialize schema
db1.exec(`
  CREATE TABLE IF NOT EXISTS test_persistence (
    id TEXT PRIMARY KEY,
    test_value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Insert test record
const testId = 'TEST_' + Date.now();
db1.prepare('INSERT INTO test_persistence (id, test_value) VALUES (?, ?)').run(testId, 'Persistence Test');
console.log('Created test record with ID:', testId);

// Close first connection (simulates server restart)
db1.close();
console.log('Closed database connection (simulating server restart)');

// Second connection - verify data persists
const db2 = new Database(DB_PATH);
const record = db2.prepare('SELECT * FROM test_persistence WHERE id = ?').get(testId);

if (record) {
  console.log('SUCCESS: Record found after reconnect:', record);
} else {
  console.log('FAILURE: Record not found after reconnect');
  process.exit(1);
}

// Cleanup
db2.prepare('DELETE FROM test_persistence WHERE id = ?').run(testId);
db2.close();
console.log('Test completed successfully - data persists across connections');
