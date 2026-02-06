/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server external packages for Node.js built-in modules
  serverExternalPackages: ['better-sqlite3'],
  // Ensure we can use Node.js built-in modules
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
    }
    return config;
  },
  // Dev server configuration
  devIndicators: false,
  // Bind to localhost only to avoid permission issues
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
};

export default nextConfig;
