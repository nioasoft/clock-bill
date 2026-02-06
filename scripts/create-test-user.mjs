import { scrypt } from 'crypto';
import { promisify } from 'util';
import { Pool } from 'pg';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = Buffer.from('test-salt-16-bytes-').toString('base64');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}:${derivedKey.toString('base64')}`;
}

async function main() {
  const pool = new Pool({
    connectionString: 'postgresql://clockbill:clockbill_dev@localhost:5432/clockbill'
  });

  const email = 'regression@test.com';
  const password = 'test123456';
  const hashedPassword = await hashPassword(password);

  await pool.query(
    'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET password_hash = $3',
    ['regression-test-id', email, hashedPassword]
  );

  console.log(`✓ Created test user: ${email} / ${password}`);
  await pool.end();
}

main().catch(console.error);
