import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { isAllowedPushEndpoint } from "@/lib/push";

const logger = createLogger("api:push:subscribe");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SubscribeBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  /** IANA zone from Intl.DateTimeFormat().resolvedOptions().timeZone. */
  timezone?: string;
}

/**
 * POST /api/push/subscribe
 * Stores (or refreshes) the caller's Web Push subscription. Upserts by endpoint
 * so re-subscribing the same browser is idempotent. Optionally records the
 * browser timezone so the daily-reminder cron can fire at the user's local time.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as SubscribeBody;
    const endpoint = body.endpoint;
    const p256dh = body.keys?.p256dh;
    const auth = body.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { success: false, error_code: "INVALID_INPUT", message: "פרטי הרשמה חסרים" },
        { status: 400 }
      );
    }

    // SSRF guard: only store endpoints hosted by a known push provider, so the
    // notifications cron can't be steered to POST at an internal/metadata URL.
    if (!isAllowedPushEndpoint(endpoint)) {
      return NextResponse.json(
        { success: false, error_code: "INVALID_ENDPOINT", message: "כתובת התראות לא נתמכת" },
        { status: 400 }
      );
    }

    const userAgent = request.headers.get("user-agent")?.slice(0, 255) ?? null;

    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint)
       DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh,
                     auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent`,
      [user.id, endpoint, p256dh, auth, userAgent]
    );

    // Best-effort: keep the user's timezone fresh for the reminder cron.
    if (body.timezone && /^[A-Za-z0-9_+\-/]{1,64}$/.test(body.timezone)) {
      await query(
        `UPDATE user_profiles SET timezone = $1, updated_at = NOW() WHERE user_id = $2`,
        [body.timezone, user.id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to store push subscription", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בשמירת ההרשמה להתראות" },
      { status: 500 }
    );
  }
}
