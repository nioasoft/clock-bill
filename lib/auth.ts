/**
 * Authentication utilities backed by Better Auth.
 *
 * `getUser()` / `getSessionUserId()` read the Better Auth session; the latter
 * also feeds the DB layer's RLS tenant binding. The legacy custom scrypt/JWT/
 * cookie-session helpers (hashPassword, verifyJWT, COOKIE_OPTIONS, …) were
 * removed once Better Auth became the sole auth path — they had no callers.
 */

/**
 * User object returned by getUser
 */
export interface User {
  id: string;
  email: string;
  emailVerified?: boolean;
  role: string;
  name?: string | null;
}

/**
 * Get the current authenticated user from the Better Auth session.
 * Returns null if not authenticated.
 *
 * This is the single source of identity for every API route's tenant-isolation
 * filter (`WHERE user_id = $`). Keep the returned shape stable.
 */
export async function getUser(): Promise<User | null> {
  try {
    const { headers } = await import("next/headers");
    const { auth } = await import("./auth/better-auth");

    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return null;
    }

    const sessionUser = session.user as {
      id: string;
      email: string;
      emailVerified?: boolean;
      role?: string | null;
      name?: string | null;
    };

    return {
      id: sessionUser.id,
      email: sessionUser.email,
      emailVerified: sessionUser.emailVerified,
      role: sessionUser.role ?? "user",
      name: sessionUser.name ?? null,
    };
  } catch {
    return null;
  }
}

// Short-lived per-token cache so the many query() calls in one request don't
// each re-resolve the session. Better Auth's cookieCache makes getSession cheap,
// and this avoids redundant work within a request.
const sessionIdCache = new Map<string, { id: string; exp: number }>();

/**
 * Resolve just the current user's id from the Better Auth session, for RLS
 * binding inside the DB layer. Returns null when unauthenticated. Cached briefly
 * by session token. Safe outside a request context (returns null, never throws).
 */
export async function getSessionUserId(): Promise<string | null> {
  try {
    const { cookies, headers } = await import("next/headers");
    const cookieStore = await cookies();
    const token =
      cookieStore.get("better-auth.session_token")?.value ??
      cookieStore.get("__Secure-better-auth.session_token")?.value ??
      null;

    if (!token) return null;

    const now = Date.now();
    const cached = sessionIdCache.get(token);
    if (cached && cached.exp > now) return cached.id;

    const { auth } = await import("./auth/better-auth");
    const session = await auth.api.getSession({ headers: await headers() });
    const id = session?.user?.id ?? null;
    if (id) {
      sessionIdCache.set(token, { id, exp: now + 5000 });
      if (sessionIdCache.size > 1000) {
        for (const k of sessionIdCache.keys()) {
          sessionIdCache.delete(k);
          if (sessionIdCache.size <= 500) break;
        }
      }
    }
    return id;
  } catch {
    return null;
  }
}
