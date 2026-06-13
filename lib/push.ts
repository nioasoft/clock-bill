/**
 * Server-side Web Push sender (VAPID).
 *
 * Sends notifications to a user's stored push subscriptions so alerts arrive
 * even when the app/tab is closed (and on installed iOS PWAs, where the
 * foreground Notifications API is unavailable). Reads/cleans subscriptions via
 * the privileged adminQuery() connection because the notifications cron runs
 * cross-tenant (no per-request RLS context).
 *
 * Degrades gracefully: if VAPID env is unset, isPushConfigured() is false and
 * senders no-op instead of throwing — keeps dev/local working without keys.
 */
import webpush from "web-push";
import { adminQuery } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const logger = createLogger("push");

let configured: boolean | null = null;

/** Whether VAPID keys are present and the web-push client is configured. */
export function isPushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@clock-bill.com";
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

/** Notification payload delivered to the service worker's `push` handler. */
export interface PushPayload {
  title: string;
  body: string;
  /** Where notificationclick navigates. Defaults to /dashboard in the SW. */
  url?: string;
  /** Collapses notifications with the same tag. */
  tag?: string;
  /** "he" | "en" — sets dir/lang in the shown notification. */
  lang?: string;
}

interface SubRow extends Record<string, unknown> {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send a push to every subscription of one user. Returns how many were
 * delivered. Subscriptions rejected as gone (404/410) are deleted so they don't
 * accumulate. Never throws — logs and continues per endpoint.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!isPushConfigured()) return 0;

  const { rows } = await adminQuery<SubRow>(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  );
  if (rows.length === 0) return 0;

  const body = JSON.stringify(payload);
  let delivered = 0;
  const expiredIds: string[] = [];

  await Promise.all(
    rows.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        delivered += 1;
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          expiredIds.push(sub.id); // subscription gone — prune it
        } else {
          logger.error(`push send failed for ${sub.endpoint.slice(0, 40)}…`, error);
        }
      }
    })
  );

  if (expiredIds.length > 0) {
    await adminQuery(`DELETE FROM push_subscriptions WHERE id = ANY($1::text[])`, [expiredIds]);
  }

  return delivered;
}
