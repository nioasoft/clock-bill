import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Content-Security-Policy shipped in REPORT-ONLY mode first: it only reports
// violations, never blocks, so it cannot break the app. 'unsafe-inline' is the
// pragmatic baseline (the no-flash theme script + framework inline scripts);
// tightening to a hash/nonce is a deliberate follow-up once report-only is clean.
// External origins allowed: Vercel Analytics/Speed-Insights (va.vercel-scripts.com,
// vitals.vercel-insights.com). The Sentry tunnel is same-origin (/monitoring → 'self').
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com wss:",
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
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
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
