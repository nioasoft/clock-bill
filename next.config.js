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

module.exports = nextConfig;
