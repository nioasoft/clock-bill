/**
 * Unguessable, URL-safe token for the public charge-document view.
 * 18 random bytes → 24 base64url chars (~143 bits of entropy). Treat the
 * resulting link as a bearer capability; regenerate to revoke.
 */
import { randomBytes } from "crypto";

export function generatePublicToken(): string {
  return randomBytes(18).toString("base64url");
}
