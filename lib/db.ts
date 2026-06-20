/**
 * Database connection module using pg (PostgreSQL)
 * Connects to PostgreSQL via connection pool for concurrent request handling
 */
import { AsyncLocalStorage } from "async_hooks";
import { Pool, PoolClient, QueryResult, types } from "pg";
import { withConnRetry } from "./db-retry";
import { getAdminDatabaseUrl, getDatabaseUrl } from "./env";

// `timestamp without time zone` (OID 1114) is parsed by node-postgres using the
// Node PROCESS's local timezone. The same stored value therefore reads correctly
// on a UTC host (Vercel) but is shifted by N hours on a UTC+N dev machine —
// which inflated the running-timer elapsed (e.g. +3h in Israel / IDT).
// All our timestamps are persisted as UTC wall-clock (NOW() on Neon=UTC, or
// JS toISOString()), so force tz-less timestamps to be read as UTC everywhere,
// independent of the host timezone. Returned Dates are correct instants; the
// browser still renders them in the user's local time for display.
types.setTypeParser(types.builtins.TIMESTAMP, (value: string | null) =>
  value === null ? null : new Date(`${value.replace(" ", "T")}Z`)
);

let pool: Pool | null = null;
let adminPool: Pool | null = null;

/**
 * Request-scoped tenant context for Row-Level Security.
 *
 * `getUser()` calls `setUserContext(userId)` (via enterWith) at the start of a
 * request; `query()` / `withTransaction()` then run authed queries inside a
 * transaction that sets `app.current_user_id`, which the RLS policies read via
 * `current_setting('app.current_user_id', true)`.
 *
 * This is a no-op for RLS enforcement until the app connects with a DB role
 * that lacks BYPASSRLS (the GUC is still set harmlessly before then).
 */
const userContext = new AsyncLocalStorage<{ userId: string }>();

/** Establish the current request's user id for RLS. Safe to call repeatedly. */
export function setUserContext(userId: string): void {
  userContext.enterWith({ userId });
}

/** The explicit in-frame tenant context, if set (e.g. by the signup hook). */
export function getCurrentUserId(): string | null {
  return userContext.getStore()?.userId || null;
}

/**
 * Resolve the tenant user id for RLS: prefer an explicitly-set in-frame context
 * (reliable, used by the signup hook), otherwise fall back to the Better Auth
 * session. The fallback is needed because AsyncLocalStorage.enterWith set inside
 * getUser() does NOT propagate back to the Next route handler frame.
 */
async function resolveTenantUserId(): Promise<string | null> {
  const ctx = getCurrentUserId();
  if (ctx) return ctx;
  try {
    const { getSessionUserId } = await import("@/lib/auth");
    return await getSessionUserId();
  } catch {
    return null;
  }
}

/**
 * Get or create the connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      // Each serverless instance keeps its own pool, and prod already talks to
      // Neon's PgBouncer (-pooler) endpoint — so a large per-instance pool just
      // burns Neon connections (N instances × max). Keep it small.
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    // Neon/PgBouncer closes idle connections; pg then emits 'error' on the idle
    // client. Without this listener Node escalates it to an uncaughtException —
    // FATAL on Vercel Fluid Compute, where one instance serves concurrent
    // requests. Swallow + log so it stays a recoverable event (the next query
    // gets a fresh connection via withConnRetry).
    pool.on("error", (err) => {
      console.error("[db] idle client error (recovered):", err.message);
    });
  }
  return pool;
}

/**
 * Get or create the privileged admin connection pool (BYPASSRLS role).
 * Used ONLY by adminQuery() for cross-tenant aggregate reads.
 */
function getAdminPool(): Pool {
  if (!adminPool) {
    adminPool = new Pool({
      connectionString: getAdminDatabaseUrl(),
      // Admin reads are infrequent (one operator), keep the pool tiny.
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    // See getPool(): swallow idle-client errors so they never crash the process.
    adminPool.on("error", (err) => {
      console.error("[db-admin] idle client error (recovered):", err.message);
    });
  }
  return adminPool;
}

/**
 * Execute a parameterized query on the PRIVILEGED admin connection, bypassing
 * Row-Level Security. Use ONLY for admin-scoped, cross-tenant aggregate reads
 * (system stats / user management) from a route that has already passed
 * getAdminUser(). NEVER pass unsanitised user input here — there is no tenant
 * filter. Unlike query(), this does not bind app.current_user_id, so RLS
 * policies do not restrict the result set.
 */
export async function adminQuery<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return withConnRetry(() => getAdminPool().query<T>(text, params));
}

/**
 * Strict allowlist for safely interpolating the tenant id into a simple-protocol
 * statement. Better Auth ids are alphanumeric + `_-` (NOT RFC-4122 UUIDs), so a
 * uuid regex would reject real ids. This pattern forbids quotes, backslashes,
 * whitespace and semicolons, so the value cannot escape the SQL string literal.
 */
const SAFE_USER_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Build a single statement that opens a transaction AND binds the transaction-local
 * RLS GUC `app.current_user_id` in one network round-trip (simple query protocol).
 * The id is interpolated (constrained by SAFE_USER_ID), not parameterized, so the
 * two statements can be batched — saving a round-trip to Neon on every authed query.
 */
function beginWithTenant(userId: string): string {
  // Fail closed: never run an authed query without a correctly-bound RLS context.
  if (!SAFE_USER_ID.test(userId)) {
    throw new Error("Invalid tenant user id; refusing to bind RLS context");
  }
  return `BEGIN; SELECT set_config('app.current_user_id', '${userId}', true);`;
}

/**
 * Execute a parameterized query against the database (placeholders $1, $2, ...).
 *
 * When a tenant context is set (authed request), the query runs inside a short
 * transaction that first sets `app.current_user_id` so RLS policies apply. With
 * no context (auth/public queries), it runs directly on a pooled connection.
 */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const userId = await resolveTenantUserId();
  if (!userId) {
    return withConnRetry(() => getPool().query<T>(text, params));
  }

  // Validate before checking out a connection so a bad id fails fast.
  const begin = beginWithTenant(userId);

  // Each retry checks out a fresh client; the transaction is a single read or
  // one atomic write, so re-running it on a stale connection is safe.
  return withConnRetry(async () => {
    const client = await getPool().connect();
    try {
      await client.query(begin); // 1 round-trip: BEGIN + set_config(local)
      const result = await client.query<T>(text, params); // parameterized
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore rollback failure
      }
      throw error;
    } finally {
      client.release();
    }
  });
}

/**
 * Execute a callback within a database transaction.
 * Automatically handles BEGIN/COMMIT/ROLLBACK and binds the RLS GUC when a
 * tenant context is set.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const userId = await resolveTenantUserId();
  // Validate before checking out a connection so a bad id fails fast.
  const begin = userId ? beginWithTenant(userId) : "BEGIN";

  // A transient connection error fires at connect()/BEGIN — before the callback
  // does meaningful work — so retrying the whole block recovers a stale
  // connection without partial-effect risk.
  return withConnRetry(async () => {
    const client = await getPool().connect();
    try {
      await client.query(begin); // 1 round-trip (BEGIN [+ set_config] when authed)
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore rollback failure (e.g. connection already dead)
      }
      throw error;
    } finally {
      client.release();
    }
  });
}

/**
 * Run a transaction on the PRIVILEGED admin connection (BYPASSRLS). No tenant
 * context is bound, so callers MUST gate with getAdminUser() and pass explicit
 * `user_id` filters. Use for cross-tenant admin mutations (e.g. deleting a
 * user's data across every table) that RLS would otherwise silently block.
 */
export async function withAdminTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  return withConnRetry(async () => {
    const client = await getAdminPool().connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore rollback failure (connection may already be dead)
      }
      throw error;
    } finally {
      client.release();
    }
  });
}

/**
 * Close the connection pool
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
  if (adminPool) {
    await adminPool.end();
    adminPool = null;
  }
}

// Graceful shutdown in dev mode to prevent connection leaks on hot reload
if (process.env.NODE_ENV === "development") {
  const shutdown = () => {
    closeDb().catch(() => {});
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
