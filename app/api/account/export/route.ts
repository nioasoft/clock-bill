import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const logger = createLogger("account:export");

/**
 * GET /api/account/export
 *
 * GDPR right of access / data portability (חוק הגנת הפרטיות / GDPR Art. 15 + 20):
 * returns a single JSON file containing ALL of the authenticated user's data,
 * one array per table, scoped strictly by `user_id`. The id comes ONLY from the
 * session (getUser) — never from a request body/param — so a user can only ever
 * export their own rows (BOLA-safe). RLS also scopes every query as defense in
 * depth. The response is delivered as an attachment download.
 */

// Every application table carrying a `user_id` column. Order is informational
// only (this is a read-only export). Kept in sync with src/db/schema.ts.
const USER_SCOPED_TABLES = [
  "user_profiles",
  "clients",
  "client_rates",
  "projects",
  "tasks",
  "time_entries",
  "charge_documents",
  "charge_document_lines",
  "report_presets",
  "custom_tags",
] as const;

export async function GET(): Promise<NextResponse> {
  let userId: string | undefined;
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }
    const limited = await enforceRateLimit({ name: "account-export", identifier: user.id, limit: 5, windowSec: 300 });
    if (limited) return limited;
    userId = user.id;
    const uid = user.id;

    const tables: Record<string, unknown[]> = {};
    for (const table of USER_SCOPED_TABLES) {
      // Table names come from a fixed allow-list (never user input), so the
      // identifier interpolation is safe; the user_id value stays parameterized.
      const result = await query(
        `SELECT * FROM ${table} WHERE user_id = $1`,
        [uid]
      );
      tables[table] = result.rows;
    }

    const exportedAt = new Date().toISOString();
    const payload = {
      exportedAt,
      user: { email: user.email },
      ...tables,
    };

    logger.info("User data exported", { userId: uid });

    const filename = `clockbill-data-export-${exportedAt.slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logger.error("Failed to export user data", error, userId ? { userId } : undefined);
    return NextResponse.json(
      { success: false, message: "שגיאה ביצוא הנתונים" },
      { status: 500 }
    );
  }
}
