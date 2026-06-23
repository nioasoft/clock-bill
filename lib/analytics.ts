/**
 * Thin wrapper over Vercel Analytics custom events.
 *
 * Centralizes our funnel event names so they stay consistent and so we never
 * accidentally pass PII (emails, names, ids) into an event payload — Vercel
 * custom-event properties are sent as-is. Pageviews are already tracked by
 * `<Analytics>` (see `components/analytics.tsx`); these events add the
 * conversion-funnel steps that pageviews can't answer (reached signup →
 * submitted → succeeded / verification sent / failed).
 *
 * Cookieless, no extra dependency, no consent banner. View in the Vercel
 * dashboard under Analytics → Events. For real multi-step funnels + session
 * replay, PostHog is the future upgrade (see deployment-envs playbook).
 */
import { track } from "@vercel/analytics";

/** Funnel event names — keep this the single source of truth. */
export type AnalyticsEvent =
  | "signup_page_view"
  | "signup_submitted"
  | "signup_success"
  | "signup_verification_sent"
  | "signup_failed"
  | "signup_google_clicked"
  | "login_page_view";

/**
 * Allowed property values. Strings only — and callers must pass non-PII,
 * low-cardinality values (e.g. a failure reason or a CTA location), never an
 * email, name, or id.
 */
type EventProps = Record<string, string>;

/**
 * Fire a funnel event. No-throw: analytics must never break a user flow, so a
 * failure here is swallowed.
 */
export function trackEvent(event: AnalyticsEvent, props?: EventProps): void {
  try {
    track(event, props);
  } catch {
    // Analytics is best-effort; never let it interrupt the user.
  }
}
