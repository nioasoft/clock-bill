import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { Pool } from 'pg';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('base64');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}:${derivedKey.toString('base64')}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  const email = 'regression@test.com';
  const password = 'test123456';
  const hashedPassword = await hashPassword(password);

  await pool.query(
    'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET password_hash = $3',
    ['regression-test-id', email, hashedPassword]
  );

  console.log(`Created test user: ${email} / ${password}`);
  await pool.end();
}

main().catch(console.error);
