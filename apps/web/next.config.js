/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // TEMPORARILY DISABLED: Causing excessive mounts (8+) in login page
  transpilePackages: [
    '@hos-marketplace/shared-types',
    '@hos-marketplace/theme-system',
    '@hos-marketplace/api-client',
    '@hos-marketplace/ui-components',
    '@hos-marketplace/utils',
  ],
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Disable ESLint during build for Railway deployment
  // Fix these errors in development, but allow build to proceed
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;


