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
};

export default nextConfig;
