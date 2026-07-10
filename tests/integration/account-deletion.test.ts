import { randomBytes } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import {
  USER_DATA_DELETE_ORDER,
  deleteUserDatabaseRows,
} from "../../lib/user-data-lifecycle";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function localTestDatabaseUrl(): string {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error("TEST_DATABASE_URL is required for the isolated account-deletion test");
  }

  const url = new URL(connectionString);
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error(`Refusing to run destructive integration test against non-local host: ${url.hostname}`);
  }
  return connectionString;
}

const AUXILIARY_TABLES = [
  "currency_rates",
  "report_presets",
  "custom_tags",
  "push_subscriptions",
  "trial_emails_sent",
] as const;

async function createFixtureSchema(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE "user" (
      id text PRIMARY KEY,
      email text NOT NULL UNIQUE
    );
    CREATE TABLE "session" (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
    );
    CREATE TABLE "account" (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
    );
    CREATE TABLE user_profiles (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT
    );
    CREATE TABLE clients (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT
    );
    CREATE TABLE projects (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
      client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE
    );
    CREATE TABLE client_rates (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
      client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE
    );
    CREATE TABLE tasks (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
      client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      rate_id text REFERENCES client_rates(id) ON DELETE SET NULL
    );
    CREATE TABLE time_entries (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
      project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      task_id text REFERENCES tasks(id) ON DELETE SET NULL
    );
    CREATE TABLE charge_documents (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
      client_id text NOT NULL REFERENCES clients(id) ON DELETE RESTRICT
    );
    CREATE TABLE charge_document_lines (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
      document_id text NOT NULL REFERENCES charge_documents(id) ON DELETE CASCADE,
      time_entry_id text REFERENCES time_entries(id) ON DELETE SET NULL
    );
    CREATE TABLE charge_document_payments (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
      document_id text NOT NULL REFERENCES charge_documents(id) ON DELETE CASCADE
    );
    CREATE TABLE currency_rates (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT
    );
    CREATE TABLE report_presets (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT
    );
    CREATE TABLE custom_tags (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT
    );
    CREATE TABLE push_subscriptions (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT
    );
    CREATE TABLE trial_emails_sent (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT
    );
  `);
}

async function seedUser(client: PoolClient, userId: string): Promise<void> {
  const prefix = userId.replace(/[^A-Za-z0-9_-]/g, "_");
  const clientId = `${prefix}_client`;
  const projectId = `${prefix}_project`;
  const rateId = `${prefix}_rate`;
  const taskId = `${prefix}_task`;
  const entryId = `${prefix}_entry`;
  const documentId = `${prefix}_document`;

  await client.query('INSERT INTO "user" (id, email) VALUES ($1, $2)', [
    userId,
    `${prefix}@example.test`,
  ]);
  await client.query('INSERT INTO "session" (id, user_id) VALUES ($1, $2)', [
    `${prefix}_session`,
    userId,
  ]);
  await client.query('INSERT INTO "account" (id, user_id) VALUES ($1, $2)', [
    `${prefix}_account`,
    userId,
  ]);
  await client.query("INSERT INTO user_profiles (id, user_id) VALUES ($1, $2)", [
    `${prefix}_profile`,
    userId,
  ]);
  await client.query("INSERT INTO clients (id, user_id) VALUES ($1, $2)", [clientId, userId]);
  await client.query("INSERT INTO projects (id, user_id, client_id) VALUES ($1, $2, $3)", [
    projectId,
    userId,
    clientId,
  ]);
  await client.query("INSERT INTO client_rates (id, user_id, client_id) VALUES ($1, $2, $3)", [
    rateId,
    userId,
    clientId,
  ]);
  await client.query(
    "INSERT INTO tasks (id, user_id, client_id, project_id, rate_id) VALUES ($1, $2, $3, $4, $5)",
    [taskId, userId, clientId, projectId, rateId]
  );
  await client.query(
    "INSERT INTO time_entries (id, user_id, project_id, task_id) VALUES ($1, $2, $3, $4)",
    [entryId, userId, projectId, taskId]
  );
  await client.query(
    "INSERT INTO charge_documents (id, user_id, client_id) VALUES ($1, $2, $3)",
    [documentId, userId, clientId]
  );
  await client.query(
    "INSERT INTO charge_document_lines (id, user_id, document_id, time_entry_id) VALUES ($1, $2, $3, $4)",
    [`${prefix}_line`, userId, documentId, entryId]
  );
  await client.query(
    "INSERT INTO charge_document_payments (id, user_id, document_id) VALUES ($1, $2, $3)",
    [`${prefix}_payment`, userId, documentId]
  );

  for (const table of AUXILIARY_TABLES) {
    await client.query(`INSERT INTO ${table} (id, user_id) VALUES ($1, $2)`, [
      `${prefix}_${table}`,
      userId,
    ]);
  }
}

async function rowCount(
  client: PoolClient,
  table: string,
  column: "id" | "user_id",
  userId: string
): Promise<number> {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${table} WHERE ${column} = $1`,
    [userId]
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function assertUserRows(
  client: PoolClient,
  userId: string,
  expected: number
): Promise<void> {
  for (const table of USER_DATA_DELETE_ORDER) {
    const count = await rowCount(client, table, "user_id", userId);
    assert(count === expected, `${table} count for ${userId}: expected ${expected}, got ${count}`);
  }
  for (const table of ['"session"', '"account"']) {
    const count = await rowCount(client, table, "user_id", userId);
    assert(count === expected, `${table} count for ${userId}: expected ${expected}, got ${count}`);
  }
  const userCount = await rowCount(client, '"user"', "id", userId);
  assert(userCount === expected, `user count for ${userId}: expected ${expected}, got ${userCount}`);
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: localTestDatabaseUrl(), max: 1 });
  const client = await pool.connect();
  const schema = `account_deletion_${randomBytes(8).toString("hex")}`;
  let schemaCreated = false;

  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    await client.query(`SET search_path TO "${schema}"`);
    await createFixtureSchema(client);

    const targetUserId = "target_user";
    const controlUserId = "control_user";
    await seedUser(client, targetUserId);
    await seedUser(client, controlUserId);

    // Prove rollback compatibility: a transaction that aborts after the shared
    // executor must restore every row, including the identity and sessions.
    await client.query("BEGIN");
    await deleteUserDatabaseRows(client, targetUserId);
    await assertUserRows(client, targetUserId, 0);
    await client.query("ROLLBACK");
    await assertUserRows(client, targetUserId, 1);

    await client.query("BEGIN");
    await deleteUserDatabaseRows(client, targetUserId);
    await client.query("COMMIT");

    await assertUserRows(client, targetUserId, 0);
    await assertUserRows(client, controlUserId, 1);
    console.log("  ✅ account deletion is complete, transactional, and tenant-scoped on PostgreSQL 16");
  } finally {
    try {
      await client.query("ROLLBACK");
      await client.query("RESET search_path");
      if (schemaCreated) await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      client.release();
      await pool.end();
    }
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
