/**
 * Source of truth for application tables owned by a user.
 *
 * Better Auth tables (`user`, `account`, `session`) are handled separately
 * because exporting their raw rows would expose password hashes and session
 * tokens. `audit_events` is an append-only security log with its own retention
 * policy and is intentionally not part of the portable application dataset.
 */
export const USER_DATA_EXPORT_TABLES = [
  "user_profiles",
  "clients",
  "client_rates",
  "projects",
  "tasks",
  "time_entries",
  "charge_documents",
  "charge_document_lines",
  "charge_document_payments",
  "report_presets",
  // Created by the hand-written 0005 migration; not represented in the legacy
  // Drizzle schema snapshot, but it is user-scoped and RLS-protected in Postgres.
  "currency_rates",
  "custom_tags",
  "push_subscriptions",
  "trial_emails_sent",
] as const;

export type UserDataTable = (typeof USER_DATA_EXPORT_TABLES)[number];

/** Child-to-parent order. Keep FK children before their restricted parents. */
export const USER_DATA_DELETE_ORDER: readonly UserDataTable[] = [
  "charge_document_lines",
  "charge_document_payments",
  "charge_documents",
  "time_entries",
  "tasks",
  "client_rates",
  "projects",
  "clients",
  "currency_rates",
  "report_presets",
  "custom_tags",
  "push_subscriptions",
  "trial_emails_sent",
  "user_profiles",
];

/**
 * Build fixed SQL statements from the compile-time allow-list above.
 * Values remain parameterized by callers; request data is never interpolated.
 */
export function buildUserDataDeleteStatements(): readonly string[] {
  return USER_DATA_DELETE_ORDER.map((table) => `DELETE FROM ${table} WHERE user_id = $1`);
}
