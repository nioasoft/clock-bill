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

// Known Web Push provider host suffixes. A real browser subscription always
// resolves to one of these; restricting to them is the SSRF guard, since the
// cron later issues server-side requests to whatever endpoint we stored.
const ALLOWED_PUSH_HOST_SUFFIXES = [
  ".googleapis.com", // FCM (Chrome/Edge/Android): fcm.googleapis.com
  ".push.apple.com", // Apple (Safari/iOS): web.push.apple.com
  ".push.services.mozilla.com", // Firefox: updates.push.services.mozilla.com
  ".notify.windows.com", // WNS (legacy Edge/Windows)
  ".push.microsoft.com",
  ".wns.windows.com",
];

/**
 * True only for an https URL hosted by a known push provider. Rejects IP
 * literals, internal hosts, and the cloud metadata endpoint, so an authenticated
 * user cannot register an SSRF target the notifications cron would later POST to.
 */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_PUSH_HOST_SUFFIXES.some(
    (suffix) => host.endsWith(suffix) && host.length > suffix.length
  );
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
      // Defense-in-depth: never POST server-side to a non-provider endpoint,
      // even if an older row predates subscribe-time validation.
      if (!isAllowedPushEndpoint(sub.endpoint)) {
        logger.warn(`skipping non-allowed push endpoint ${sub.endpoint.slice(0, 40)}…`);
        return;
      }
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
