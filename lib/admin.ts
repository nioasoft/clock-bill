/**
 * Admin guard utility
 * Verifies the current user has admin role
 */
import { getFreshUser, type User } from "./auth";

/**
 * Get the current user if they have admin role
 * Returns null if not authenticated or not an admin
 */
export async function getAdminUser(): Promise<User | null> {
  const user = await getFreshUser();
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}
