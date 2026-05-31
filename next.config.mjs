import { withSentryConfig } from "@sentry/nextjs";

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
};

// Wrap with Sentry. Build-safe without any Sentry env: source maps upload only
// when SENTRY_AUTH_TOKEN (+ org/project) are present; the runtime SDK stays inert
// unless NEXT_PUBLIC_SENTRY_DSN is set.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Tunnel events through the app so ad-blockers don't drop them.
  tunnelRoute: "/monitoring",
});
