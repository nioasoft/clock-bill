import * as Sentry from "@sentry/nextjs";

// Client-side Sentry init. Inert without a DSN.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
    environment: process.env.NODE_ENV,
    // Drop noise from browser extensions (wallets, etc.) injected into the page.
    // These errors come from the visitor's extension, not from Monit's code.
    ignoreErrors: [
      /MetaMask/i,
      /Failed to connect to MetaMask/i,
      /ethereum/i,
      // Common extension / third-party noise
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
    ],
    denyUrls: [
      /inpage\.js/i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
      /^safari-extension:\/\//i,
      /extensions\//i,
    ],
  });
}

// Instruments client-side navigations for performance tracing (no-op if uninit).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
