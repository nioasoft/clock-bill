import { NextRequest, NextResponse } from "next/server";
import { adminQuery } from "@/lib/db";
import { isPushConfigured, sendPushToUser } from "@/lib/push";
import { createLogger } from "@/lib/logger";

const logger = createLogger("cron:notifications");

// pg + web-push need the Node runtime; always run dynamically.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Localized push copy (server context has no next-intl request scope, so mirror
 * the Dashboard.notifications strings inline — keep in sync with messages/*.json).
 */
type Loc = "he" | "en";
const norm = (l: string | null): Loc => (l === "en" ? "en" : "he");

function longTimerCopy(locale: Loc, elapsedMinutes: number) {
  const hours = Math.floor(elapsedMinutes / 60);
  const mins = elapsedMinutes % 60;
  if (locale === "en") {
    return {
      title: "Timer has been running for a long time",
      body:
        hours > 0
          ? `The timer has been running for ${hours} hours and ${mins} minutes. Maybe take a break?`
          : `The timer has been running for ${elapsedMinutes} minutes. Maybe take a break?`,
    };
  }
  return {
    title: "הטיימר רץ זמן רב",
    body:
      hours > 0
        ? `הטיימר רץ כבר ${hours} שעות ו-${mins} דקות. אולי כדאי לקחת הפסקה?`
        : `הטיימר רץ כבר ${elapsedMinutes} דקות. אולי כדאי לקחת הפסקה?`,
  };
}

function dailyReminderCopy(locale: Loc) {
  return locale === "en"
    ? { title: "Daily reminder", body: "Hi! You haven't logged any time entries today. Start logging your time." }
    : { title: "תזכורת יומית", body: "שלום! עדיין לא הזנת רשומות זמן היום. למשל, התחל לרשום זמן." };
}

interface ReminderRow extends Record<string, unknown> {
  user_id: string;
  locale: string | null;
}
interface LongTimerRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  locale: string | null;
  elapsed_minutes: number;
}

/**
 * GET /api/cron/notifications
 *
 * Fired by a Vercel cron (every 5 min) to deliver Web Push notifications that
 * must work when the app is closed:
 *   1. Daily reminder — at the user's LOCAL dailyReminderTime (timezone-aware),
 *      once per local day (last_reminder_date guard).
 *   2. Long timer — a running, non-paused timer past the user's threshold; a
 *      long_timer_notified_at marker makes it fire once per run.
 *
 * Cross-tenant, so it reads/writes via the privileged adminQuery() connection
 * (bypasses RLS). Protected by CRON_SECRET when set, like keep-alive.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  if (!isPushConfigured()) {
    return NextResponse.json({ ok: true, skipped: "push not configured" });
  }

  let reminders = 0;
  let longTimers = 0;

  try {
    // ── 1. Daily reminders due in this 5-min window (user-local time) ──
    const reminderRows = await adminQuery<ReminderRow>(
      `SELECT user_id, locale
       FROM user_profiles
       WHERE daily_reminder_enabled = true
         AND (last_reminder_date IS NULL
              OR last_reminder_date < (now() AT TIME ZONE COALESCE(timezone, 'Asia/Jerusalem'))::date)
         AND (
           (EXTRACT(HOUR   FROM (now() AT TIME ZONE COALESCE(timezone, 'Asia/Jerusalem'))) * 60
          + EXTRACT(MINUTE FROM (now() AT TIME ZONE COALESCE(timezone, 'Asia/Jerusalem'))))
          - (split_part(daily_reminder_time, ':', 1)::int * 60
           + split_part(daily_reminder_time, ':', 2)::int)
         ) BETWEEN 0 AND 4`
    );

    for (const row of reminderRows.rows) {
      const copy = dailyReminderCopy(norm(row.locale));
      const sent = await sendPushToUser(row.user_id, {
        ...copy,
        url: "/dashboard",
        tag: "daily-reminder",
        lang: norm(row.locale),
      });
      if (sent > 0) {
        reminders += 1;
        await adminQuery(
          `UPDATE user_profiles
           SET last_reminder_date = (now() AT TIME ZONE COALESCE(timezone, 'Asia/Jerusalem'))::date,
               updated_at = NOW()
           WHERE user_id = $1`,
          [row.user_id]
        );
      }
    }

    // ── 2. Long-running timers past threshold, not yet notified ──
    const longRows = await adminQuery<LongTimerRow>(
      `SELECT te.id, te.user_id, p.locale,
              FLOOR((EXTRACT(EPOCH FROM ((now() AT TIME ZONE 'UTC') - te.start_time)) * 1000
                     - COALESCE(te.total_paused_time, 0)) / 60000)::int AS elapsed_minutes
       FROM time_entries te
       JOIN user_profiles p ON p.user_id = te.user_id
       WHERE te.start_time IS NOT NULL
         AND te.end_time IS NULL
         AND te.paused_at IS NULL
         AND te.long_timer_notified_at IS NULL
         AND COALESCE(p.long_timer_enabled, true) = true
         AND (EXTRACT(EPOCH FROM ((now() AT TIME ZONE 'UTC') - te.start_time)) * 1000
              - COALESCE(te.total_paused_time, 0)) / 60000 >= COALESCE(p.long_timer_threshold, 120)`
    );

    for (const row of longRows.rows) {
      const copy = longTimerCopy(norm(row.locale), row.elapsed_minutes);
      const sent = await sendPushToUser(row.user_id, {
        ...copy,
        url: "/dashboard",
        tag: `long-timer-${row.id}`,
        lang: norm(row.locale),
      });
      if (sent > 0) {
        longTimers += 1;
        await adminQuery(`UPDATE time_entries SET long_timer_notified_at = now() WHERE id = $1`, [
          row.id,
        ]);
      }
    }

    return NextResponse.json({ ok: true, reminders, longTimers });
  } catch (error) {
    logger.error("notifications cron failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
