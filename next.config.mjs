import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Enforced Content-Security-Policy for production. 'unsafe-inline' remains the
// pragmatic Turbopack-compatible baseline for the no-flash theme bootstrap and
// framework styles/scripts. A nonce would force dynamic rendering across the
// App Router, while hash/SRI support is currently webpack-only in Next.js 16.
// External origins allowed: Vercel Analytics/Speed-Insights (va.vercel-scripts.com,
// vitals.vercel-insights.com). The Sentry tunnel is same-origin (/monitoring → 'self').
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com wss:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

// Enforced security headers (these are safe to enforce immediately).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // CSP is PRODUCTION only: dev (Turbopack HMR) legitimately uses eval() and
  // inline tooling that an enforced production policy must reject.
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dev server configuration
  devIndicators: false,
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  // Optimize images by default (for future use)
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // Production optimizations
  productionBrowserSourceMaps: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

// Wrap with Sentry. Build-safe without any Sentry env: source maps upload only
// when SENTRY_AUTH_TOKEN (+ org/project) are present; the runtime SDK stays inert
// unless NEXT_PUBLIC_SENTRY_DSN is set.
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Tunnel events through the app so ad-blockers don't drop them.
  tunnelRoute: "/monitoring",
});
