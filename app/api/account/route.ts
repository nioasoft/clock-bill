import { NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { deleteFile } from "@/lib/storage";
import { deleteUserDatabaseRows } from "@/lib/user-data-lifecycle";

const logger = createLogger("account:delete");

/**
 * DELETE /api/account
 *
 * Permanently and irreversibly deletes the authenticated user's tenant-owned
 * application data and Better Auth identity (the "delete my data" right — חוק
 * הגנת הפרטיות / GDPR). Database deletion is transactional: app data first
 * (children → parents to satisfy FKs), then account → session → user.
 */
export async function DELETE() {
  let userId: string | undefined;
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }
    userId = user.id;
    const uid = user.id;

    // Storage is outside the database transaction. Delete the public objects
    // first and fail closed: a successful response must not leave a logo or
    // signature behind after the profile row (and its URLs) is gone.
    const profile = await query<{ logo_url: string | null; signature_url: string | null }>(
      `SELECT logo_url, signature_url FROM user_profiles WHERE user_id = $1`,
      [uid]
    );
    const files = [profile.rows[0]?.logo_url, profile.rows[0]?.signature_url].filter(
      (url): url is string => Boolean(url)
    );
    await Promise.all(files.map((url) => deleteFile(url)));

    await withTransaction(async (client) => {
      await deleteUserDatabaseRows(client, uid);
    });

    // Best-effort: remove the Polar customer (keyed by our user id) so no billing
    // identity lingers after a GDPR delete. Never fail the deletion on Polar error.
    try {
      const { polarEnabled, getPolar } = await import("@/lib/polar");
      if (polarEnabled) {
        await getPolar().customers.deleteExternal({ externalId: uid, anonymize: true });
      }
    } catch (error) {
      logger.error("Failed to delete Polar customer on account deletion", error, { userId: uid });
    }

    logger.info("Account permanently deleted", { userId: uid });
    return NextResponse.json({ success: true, message: "החשבון נמחק לצמיתות" });
  } catch (error) {
    logger.error("Failed to delete account", error, userId ? { userId } : undefined);
    return NextResponse.json(
      { success: false, message: "שגיאה במחיקת החשבון" },
      { status: 500 }
    );
  }
}
