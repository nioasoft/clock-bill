#!/usr/bin/env node
/**
 * RLS drift check. Asserts that every user-scoped / sensitive table has RLS
 * ENABLED and FORCED. Run against a database with a privileged role:
 *
 *   DATABASE_URL_ADMIN="postgres://..." node scripts/check-rls.mjs
 *
 * Exits non-zero (and prints the offenders) if any table is missing RLS — wire
 * it into a deploy step or run it manually after schema changes. Not in CI,
 * which builds against a mock DATABASE_URL with no real database.
 */
import pg from "pg";

const EXPECTED = [
  "user_profiles",
  "clients",
  "projects",
  "tasks",
  "time_entries",
  "work_templates",
  "report_presets",
  "client_rates",
  "currency_rates",
  "charge_documents",
  "charge_document_lines",
  "charge_document_payments",
  "push_subscriptions",
  "trial_emails_sent",
  "custom_tags",
  "audit_events",
];

const url = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL_ADMIN (or DATABASE_URL) to run the RLS check.");
  process.exit(2);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
const { rows } = await client.query(
  `SELECT relname, relrowsecurity, relforcerowsecurity
     FROM pg_class WHERE relname = ANY($1) AND relkind = 'r'`,
  [EXPECTED]
);
await client.end();

const byName = new Map(rows.map((r) => [r.relname, r]));
const offenders = [];
for (const t of EXPECTED) {
  const r = byName.get(t);
  if (!r) offenders.push(`${t}: table missing`);
  else if (!r.relrowsecurity || !r.relforcerowsecurity) {
    offenders.push(`${t}: enabled=${r.relrowsecurity} forced=${r.relforcerowsecurity}`);
  }
}

if (offenders.length > 0) {
  console.error("RLS drift detected:\n  " + offenders.join("\n  "));
  process.exit(1);
}
console.log(`RLS OK — all ${EXPECTED.length} tables ENABLE+FORCE row security.`);
