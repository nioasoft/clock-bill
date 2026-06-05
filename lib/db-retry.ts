/**
 * Transient-connection-error handling for the pg pools in lib/db.ts.
 *
 * Kept in its own module (no env / no DB import) so the pure predicate can be
 * unit-tested without triggering env validation or opening a connection.
 *
 * Background: Neon/PgBouncer closes idle connections; pg then either emits
 * 'error' on the idle client or hands out a dead socket on the next checkout.
 * See the production Sentry issues CLOCK-BILL-3 / CLOCK-BILL-4.
 */

/**
 * True for the transient connection errors pg throws when the pool hands out a
 * socket that Neon/PgBouncer has already closed.
 */
export function isTransientConnectionError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /Connection terminated unexpectedly/i.test(msg) ||
    /Connection terminated due to connection timeout/i.test(msg) ||
    /Client has encountered a connection error and is not queryable/i.test(msg) ||
    /terminating connection due to administrator command/i.test(msg) ||
    /ECONNRESET/i.test(msg) ||
    /EPIPE/i.test(msg)
  );
}

/**
 * Run an operation, retrying up to `attempts` times on a transient connection
 * error with a small linear backoff. Each retry re-runs `op`, which checks out a
 * FRESH connection from the pool — so a poisoned/stale connection is recovered.
 */
export async function withConnRetry<T>(op: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await op();
    } catch (error) {
      lastErr = error;
      if (!isTransientConnectionError(error) || i === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (i + 1)));
    }
  }
  throw lastErr;
}
