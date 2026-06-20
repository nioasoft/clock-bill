import { NextRequest, NextResponse } from "next/server";
import { adminQuery } from "@/lib/db";
import { sendEmail, type EmailLocale } from "@/lib/email";
import { pickDueEmail } from "@/lib/trial-emails-schedule";
import { trialEmailFor } from "@/lib/emails/trial";
import { createLogger } from "@/lib/logger";
import { isAuthorizedCron } from "@/lib/cron-auth";

const logger = createLogger("cron:trial-lifecycle");
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const norm = (l: string | null): EmailLocale => (l === "en" ? "en" : "he");

interface TrialUserRow extends Record<string, unknown> {
  user_id: string;
  email: string | null;
  locale: string | null;
  trial_started_at: string;
  trial_ends_at: string | null;
  sent_keys: string[]; // aggregated already-sent keys
  active_client_count: number;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.clock-bill.com";
  const now = Date.now();
  let sent = 0;

  // Candidates: non-founding, free/null tier, trial started, with a verified email.
  // Skip anyone with an active paid subscription. Aggregate already-sent keys + active client count.
  const rows = await adminQuery<TrialUserRow>(
    `SELECT up.user_id, u.email, up.locale, up.trial_started_at, up.trial_ends_at,
            COALESCE(array_agg(tes.email_key) FILTER (WHERE tes.email_key IS NOT NULL), '{}') AS sent_keys,
            (SELECT COUNT(*)::int FROM clients c WHERE c.user_id = up.user_id AND c.is_active = TRUE) AS active_client_count
       FROM user_profiles up
       JOIN "user" u ON u.id = up.user_id
       LEFT JOIN trial_emails_sent tes ON tes.user_id = up.user_id
      WHERE up.trial_started_at IS NOT NULL
        AND COALESCE(up.founding, FALSE) = FALSE
        AND COALESCE(up.subscription_tier, 'free') = 'free'
        AND u.email IS NOT NULL
        AND u.email_verified = TRUE
      GROUP BY up.user_id, u.email, up.locale, up.trial_started_at, up.trial_ends_at`,
    []
  );

  for (const row of rows.rows) {
    const startedMs = new Date(row.trial_started_at).getTime();
    const daysSinceStart = Math.floor((now - startedMs) / DAY_MS);
    const due = pickDueEmail(daysSinceStart, new Set(row.sent_keys));
    if (!due || !row.email || !row.trial_ends_at) continue;

    // Reserve the send atomically: only proceed if WE inserted the row (no prior send).
    const reserve = await adminQuery(
      `INSERT INTO trial_emails_sent (user_id, email_key) VALUES ($1, $2)
       ON CONFLICT (user_id, email_key) DO NOTHING`,
      [row.user_id, due]
    );
    if ((reserve.rowCount ?? 0) === 0) continue; // already sent by a concurrent/earlier run

    const endsMs = new Date(row.trial_ends_at).getTime();
    const daysLeft = Math.max(0, Math.ceil((endsMs - now) / DAY_MS));
    const { subject, html } = trialEmailFor(due, norm(row.locale), {
      appUrl,
      daysLeft,
      lockedCount: Math.max(0, row.active_client_count - 1),
    });
    const ok = await sendEmail({ to: row.email, subject, html });
    if (ok) {
      sent++;
    } else {
      // Release the reservation so a later run retries instead of suppressing
      // this email forever (the reserve still prevents concurrent double-sends).
      await adminQuery(
        `DELETE FROM trial_emails_sent WHERE user_id = $1 AND email_key = $2`,
        [row.user_id, due]
      );
      logger.error("trial email send failed; released reservation for retry", { userId: row.user_id, key: due });
    }
  }

  logger.info("trial-lifecycle run complete", { candidates: rows.rows.length, sent });
  return NextResponse.json({ ok: true, candidates: rows.rows.length, sent });
}
