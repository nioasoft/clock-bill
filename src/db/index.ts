import { drizzle } from "drizzle-orm/node-postgres";
import { getPool } from "../../lib/db";
import * as schema from "./schema";

/**
 * Drizzle ORM instance for type-safe queries.
 * Reuses the pg Pool from lib/db.ts to share connections.
 *
 * Usage:
 *   import { db } from "@/src/db";
 *   const rows = await db.select().from(schema.users);
 *
 * Note: Most API routes still use raw query() from lib/db.ts.
 * This instance is available for new code that wants type-safe queries.
 */
export const db = drizzle(getPool(), { schema });
