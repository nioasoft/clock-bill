/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server external packages for Node.js built-in modules
  serverExternalPackages: ['better-sqlite3'],
  // Dev server configuration
  devIndicators: false,
};

module.exports = nextConfig;
