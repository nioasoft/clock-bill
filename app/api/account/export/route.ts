import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { USER_DATA_EXPORT_TABLES } from "@/lib/user-data-lifecycle";

const logger = createLogger("account:export");

/**
 * GET /api/account/export
 *
 * GDPR right of access / data portability (חוק הגנת הפרטיות / GDPR Art. 15 + 20):
 * returns a single JSON file containing the authenticated user's portable
 * application data, one array per table, scoped strictly by `user_id`. Raw auth
 * rows are intentionally excluded because they contain password hashes/session
 * tokens. The id comes ONLY from the session (getUser), and RLS provides defense
 * in depth. The response is delivered as an attachment download.
 */

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
    for (const table of USER_DATA_EXPORT_TABLES) {
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
