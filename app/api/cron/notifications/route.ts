import { NextRequest, NextResponse } from "next/server";
import { adminQuery } from "@/lib/db";
import { isPushConfigured, sendPushToUser } from "@/lib/push";
import { createLogger } from "@/lib/logger";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";
import { settlementReminderEmail } from "@/lib/emails/settlement-reminder";
import { isBillingDayToday } from "@/lib/settlements";
import { formatCurrency } from "@/lib/currency";

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

function settlementCopy(locale: Loc, count: number) {
  return locale === "en"
    ? { title: "Settlements ready", body: `You have ${count} client${count === 1 ? "" : "s"} ready for settlement.` }
    : { title: "התחשבנויות לביצוע", body: `יש לך ${count} לקוחות מוכנים להתחשבנות.` };
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
interface SettlementRow extends Record<string, unknown> {
  client_id: string;
  user_id: string;
  client_name: string;
  currency: string;
  settlement_billing_day: number;
  unbilled_total: number;
  locale: string | null;
  user_email: string | null;
  local_year: number;
  local_month: number;
  local_day: number;
  local_minutes: number;
  anchor_minutes: number;
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
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const pushOn = isPushConfigured();

  let reminders = 0;
  let longTimers = 0;
  let settlements = 0;

  try {
    if (pushOn) {
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
    }

    // ── 3. Settlement reminders — once per cycle, on each client's billing day ──
    // Cheap SQL filters (billing day set, active, has unbilled work, not yet
    // reminded this cycle) + per-row user-local calendar components; the exact
    // effective-day match is decided in JS via isBillingDayToday (handles
    // end-of-month clamping). Grouped strictly per user.
    const settlementRows = await adminQuery<SettlementRow>(
      `SELECT c.id AS client_id, c.user_id, c.name AS client_name,
              COALESCE(c.currency,'ILS') AS currency, c.settlement_billing_day,
              COALESCE(SUM(
                CASE WHEN te.billing_kind = 'item'
                     THEN COALESCE(te.quantity, 0) * COALESCE(te.rate, 0)
                     ELSE (te.duration / 60.0) * COALESCE(te.rate, 0)
                END
              ), 0) AS unbilled_total,
              p.locale, u.email AS user_email,
              EXTRACT(YEAR  FROM (now() AT TIME ZONE COALESCE(p.timezone,'Asia/Jerusalem')))::int AS local_year,
              EXTRACT(MONTH FROM (now() AT TIME ZONE COALESCE(p.timezone,'Asia/Jerusalem')))::int AS local_month,
              EXTRACT(DAY   FROM (now() AT TIME ZONE COALESCE(p.timezone,'Asia/Jerusalem')))::int AS local_day,
              (EXTRACT(HOUR   FROM (now() AT TIME ZONE COALESCE(p.timezone,'Asia/Jerusalem'))) * 60
             + EXTRACT(MINUTE FROM (now() AT TIME ZONE COALESCE(p.timezone,'Asia/Jerusalem'))))::int AS local_minutes,
              (split_part(COALESCE(p.daily_reminder_time,'09:00'), ':', 1)::int * 60
             + split_part(COALESCE(p.daily_reminder_time,'09:00'), ':', 2)::int) AS anchor_minutes
         FROM clients c
         JOIN projects p2 ON p2.client_id = c.id
         JOIN time_entries te ON te.project_id = p2.id
         JOIN user_profiles p ON p.user_id = c.user_id
         JOIN "user" u ON u.id = c.user_id
        WHERE c.settlement_billing_day IS NOT NULL
          AND c.is_active = true
          AND te.charge_document_id IS NULL
          AND te.is_billable = true
          AND (c.settlement_reminded_at IS NULL
               OR c.settlement_reminded_at < (now() AT TIME ZONE COALESCE(p.timezone,'Asia/Jerusalem'))::date)
        GROUP BY c.id, c.user_id, c.name, c.currency, c.settlement_billing_day, p.locale, u.email, p.timezone, p.daily_reminder_time`
    );
    // unbilled_total is the same APPROXIMATE figure as the due endpoint (no
    // amount column; duration is MINUTES). The INNER JOIN guarantees ≥1 unbilled
    // billable entry per row, so no HAVING is needed.

    // Keep only rows where today (user-local) is the effective billing day AND
    // we're past the user's morning anchor.
    const fireRows = settlementRows.rows.filter(
      (r) =>
        r.local_minutes >= r.anchor_minutes &&
        isBillingDayToday(r.local_day, r.settlement_billing_day, r.local_year, r.local_month)
    );

    // Group strictly by user (tenant isolation): one push + one email per user.
    const byUser = new Map<string, SettlementRow[]>();
    for (const r of fireRows) {
      const list = byUser.get(r.user_id) ?? [];
      list.push(r);
      byUser.set(r.user_id, list);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.clock-bill.com";
    for (const [userId, clientsForUser] of byUser) {
      const loc = norm(clientsForUser[0].locale);
      const count = clientsForUser.length;

      // Email (always attempted; no-ops without RESEND_API_KEY).
      const to = clientsForUser[0].user_email;
      if (to) {
        const dashboardUrl = `${appUrl}${loc === "en" ? "/en" : ""}/dashboard`;
        const { subject, html } = settlementReminderEmail(loc, {
          clients: clientsForUser.map((r) => ({
            name: r.client_name,
            amountLabel: formatCurrency(r.unbilled_total, r.currency, loc),
          })),
          dashboardUrl,
        });
        await sendEmail({ to, subject, html });
      }

      // Push (best-effort, only when configured).
      if (pushOn) {
        const copy = settlementCopy(loc, count);
        await sendPushToUser(userId, { ...copy, url: "/dashboard", tag: "settlement-reminder", lang: loc });
      }

      // Mark each fired client reminded for this cycle (scoped by user_id).
      for (const r of clientsForUser) {
        await adminQuery(
          `UPDATE clients SET settlement_reminded_at = (now() AT TIME ZONE COALESCE((SELECT timezone FROM user_profiles WHERE user_id = $2),'Asia/Jerusalem'))::date,
                              updated_at = NOW()
            WHERE id = $1 AND user_id = $2`,
          [r.client_id, userId]
        );
      }
      settlements += 1;
    }

    return NextResponse.json({ ok: true, reminders, longTimers, settlements });
  } catch (error) {
    logger.error("notifications cron failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
