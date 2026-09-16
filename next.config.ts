import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'firebase-admin',
    '@google-cloud/storage',
    '@google-cloud/firestore',
    'google-auth-library',
    'gcp-metadata',
  ],
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
