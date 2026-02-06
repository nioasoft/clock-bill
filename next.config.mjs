/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server external packages for Node.js built-in modules
  serverExternalPackages: ['better-sqlite3'],
  // Webpack config to fix React 19 resolution
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Ensure React is resolved correctly on client-side
      config.resolve.alias = {
        ...config.resolve.alias,
        'react': require.resolve('react'),
        'react-dom': require.resolve('react-dom'),
      };
    }
    return config;
  },
  // Dev server configuration
  devIndicators: false,
};

export default nextConfig;
