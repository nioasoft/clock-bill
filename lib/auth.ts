/**
 * Authentication utilities using Node.js built-in crypto
 * Provides password hashing, JWT tokens, and session management
 */
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// Import env validation and getters
import { getAuthSecret, isProduction } from "./env";

// JWT secret from environment (lazy-loaded to avoid build-time errors)
let _jwtSecret: string | null = null;
function getJwtSecret(): string {
  if (!_jwtSecret) {
    _jwtSecret = getAuthSecret();
  }
  return _jwtSecret;
}

// Token expiration time (7 days)
const TOKEN_EXPIRY = 60 * 60 * 24 * 7;

export interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

/**
 * Hash a password using scrypt
 * Format: salt:hash (both base64 encoded)
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("base64")}`;
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;

  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  const keyBuffer = Buffer.from(key, "base64");

  if (derivedKey.length !== keyBuffer.length) return false;
  return timingSafeEqual(derivedKey, keyBuffer);
}

/**
 * Generate a secure random token
 */
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString("hex");
}

/**
 * Simple JWT implementation using Web Crypto API
 */
export async function signJWT(payload: Omit<JWTPayload, "iat" | "exp">): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getJwtSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + TOKEN_EXPIRY,
  };

  // Create JWT parts
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "");
  const payloadB64 = btoa(JSON.stringify(fullPayload)).replace(/=/g, "");
  const data = `${headerB64}.${payloadB64}`;

  // Sign
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, "");

  return `${data}.${signatureB64}`;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(getJwtSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const [headerB64, payloadB64, signatureB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    // Verify signature
    const data = `${headerB64}.${payloadB64}`;
    const signature = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify("HMAC", key, signature, encoder.encode(data));

    if (!isValid) return null;

    // Decode payload
    const payload = JSON.parse(atob(payloadB64)) as JWTPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Generate a session token (for cookie-based sessions)
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Cookie options for session cookies
 */
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction(),
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: "/",
};

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
