import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Optimize for production
  compress: true,
  poweredByHeader: false,
  // Improve caching
  generateEtags: true,
};

export default nextConfig;
