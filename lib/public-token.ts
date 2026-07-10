/**
 * Unguessable, URL-safe token for the public charge-document view.
 * 18 random bytes → 24 base64url chars (~143 bits of entropy). Treat the
 * resulting link as a bearer capability; regenerate to revoke.
 */
import { randomBytes } from "crypto";

export const PUBLIC_LINK_TTL_DAYS = 30;

export function generatePublicToken(): string {
  return randomBytes(18).toString("base64url");
}

export function isValidPublicToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{24}$/.test(token);
}

export function publicLinkExpiry(now: Date = new Date()): Date {
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + PUBLIC_LINK_TTL_DAYS);
  return expiresAt;
}
