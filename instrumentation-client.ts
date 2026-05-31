import * as Sentry from "@sentry/nextjs";

// Client-side Sentry init. Inert without a DSN.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
    environment: process.env.NODE_ENV,
  });
}

// Instruments client-side navigations for performance tracing (no-op if uninit).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
