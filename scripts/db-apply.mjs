#!/usr/bin/env node
/**
 * Applies pending drizzle/NNNN_*.sql migrations in filename order, tracked in a
 * schema_migrations table (drizzle-kit's own journal is out of sync — see
 * CLAUDE.md). Run against BOTH environments before deploying code that needs a
 * new migration:
 *
 *   DATABASE_URL_ADMIN="postgres://...dev..."  npm run db:apply
 *   DATABASE_URL_ADMIN="postgres://...prod..." npm run db:apply
 *
 * `--seed` records every existing file as applied WITHOUT running it — used
 * once when adopting this script on a database that is already up to date.
 */
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const url = process.env.DATABASE_URL_ADMIN;
if (!url) {
  console.error("DATABASE_URL_ADMIN is required");
  process.exit(1);
}
const seed = process.argv.includes("--seed");

const files = (await readdir("drizzle"))
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort();

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const { rows } = await client.query("SELECT filename FROM schema_migrations");
  const done = new Set(rows.map((r) => r.filename));
  const pending = files.filter((f) => !done.has(f));

  if (pending.length === 0) {
    console.log("0 pending — schema is up to date.");
  }
  for (const f of pending) {
    if (seed) {
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [f]);
      console.log(`seeded  ${f}`);
      continue;
    }
    const sql = await readFile(`drizzle/${f}`, "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [f]);
      await client.query("COMMIT");
      console.log(`applied ${f}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`FAILED  ${f}: ${err.message}`);
      process.exit(1);
    }
  }
} finally {
  await client.end();
}
