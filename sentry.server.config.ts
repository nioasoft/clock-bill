import * as Sentry from "@sentry/nextjs";

// Server-side Sentry init. Inert unless NEXT_PUBLIC_SENTRY_DSN is set, so the
// app runs identically with Sentry unconfigured. Privacy-first: PII (IP, request
// bodies) is NOT sent by default — matches the privacy policy.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Performance/latency sampling: 10% in prod, all in dev. We deliberately keep
    // ALL routes (incl. the timer poll + cron heartbeats) traced so Sentry stays a
    // load signal — the real volume fix was cutting the polling, not hiding it.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
    environment: process.env.NODE_ENV,
  });
}
