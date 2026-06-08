import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const logger = createLogger("account:delete");

/**
 * DELETE /api/account
 *
 * Permanently and irreversibly deletes the authenticated user's account and ALL
 * their data (the "delete my data" right — חוק הגנת הפרטיות / GDPR). Runs in a
 * single transaction: app data first (children → parents to satisfy FKs), then
 * the Better Auth identity (account → session → user). The app role has DELETE
 * on every table involved.
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

    await withTransaction(async (client) => {
      // App data — order respects foreign keys (children before parents).
      await client.query(`DELETE FROM time_entries WHERE user_id = $1`, [uid]);
      await client.query(`DELETE FROM tasks WHERE user_id = $1`, [uid]);
      await client.query(`DELETE FROM projects WHERE user_id = $1`, [uid]);
      await client.query(`DELETE FROM clients WHERE user_id = $1`, [uid]);
      await client.query(`DELETE FROM report_presets WHERE user_id = $1`, [uid]);
      await client.query(`DELETE FROM custom_tags WHERE user_id = $1`, [uid]);
      await client.query(`DELETE FROM user_profiles WHERE user_id = $1`, [uid]);

      // Better Auth identity — revokes all sessions and removes the login.
      await client.query(`DELETE FROM account WHERE user_id = $1`, [uid]);
      await client.query(`DELETE FROM session WHERE user_id = $1`, [uid]);
      await client.query(`DELETE FROM "user" WHERE id = $1`, [uid]);
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
