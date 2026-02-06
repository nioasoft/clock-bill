/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dev server configuration
  devIndicators: false,
  // Use localhost instead of 0.0.0.0 to avoid permission issues
  experimental: {
    turbo: undefined,
  },
};

module.exports = nextConfig;
