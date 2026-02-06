/**
 * Authentication utilities using Node.js built-in crypto
 * Provides password hashing, JWT tokens, and session management
 */
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// JWT secret from environment
const JWT_SECRET = process.env.BETTER_AUTH_SECRET || "your-secret-key-at-least-32-characters-long";

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
    encoder.encode(JWT_SECRET),
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
      encoder.encode(JWT_SECRET),
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
  secure: process.env.NODE_ENV === "production",
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
}

/**
 * Get the current authenticated user from session cookie
 * Returns null if not authenticated
 */
export async function getUser(): Promise<User | null> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (!sessionToken) {
      return null;
    }

    // Import query here to avoid circular dependency issues
    const { query } = await import("./db");

    // Get user from session
    const result = await query<{ user_id: string; email: string }>(
      `SELECT s.user_id, u.email
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [sessionToken]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      id: result.rows[0].user_id,
      email: result.rows[0].email,
    };
  } catch {
    return null;
  }
}
