import { drizzle } from "drizzle-orm/node-postgres";
import { getPool } from "../../lib/db";
import * as schema from "./schema";

/**
 * Drizzle ORM instance for type-safe queries.
 * Reuses the pg Pool from lib/db.ts to share connections.
 *
 * ⚠️ RLS FOOTGUN — READ BEFORE USING ON USER DATA ⚠️
 * This handle runs on a bare pooled connection WITHOUT binding the per-request
 * tenant context (`app.current_user_id`) that `query()`/`withTransaction()` in
 * lib/db.ts set. RLS is FORCE-enabled on every user-data table (clients, projects,
 * tasks, time_entries, client_rates, currency_rates, user_profiles, custom_tags),
 * so using `db` against any of those FAILS CLOSED: reads return 0 rows and inserts
 * fail the WITH CHECK — silently, not with a clear error. Do NOT "fix" that by
 * loosening RLS.
 *
 * Safe for: Better Auth tables (user/session/account/verification), which are
 * intentionally not RLS'd. For user-data tables use `query()`/`withTransaction()`
 * from lib/db.ts (they bind the tenant context), or wrap `db` in one first.
 *
 * Usage (Better Auth tables only):
 *   import { db } from "@/src/db";
 *   const rows = await db.select().from(schema.user);
 */
export const db = drizzle(getPool(), { schema });
