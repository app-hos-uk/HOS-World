const path = require('path');

const withBundleAnalyzer =
  process.env.ANALYZE === 'true'
    ? require('@next/bundle-analyzer')({ enabled: true })
    : (config) => config;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Re-enabled after fixing useEffect dependencies
  // Emit a self-contained server bundle (.next/standalone) so the Docker
  // runtime stage needs no `pnpm install` and only copies a minimal tree.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  experimental: {
    optimizePackageImports: [
      '@heroicons/react',
      'recharts',
      '@headlessui/react',
      '@tanstack/react-query',
    ],
  },
  transpilePackages: [
    '@hos-marketplace/shared-types',
    '@hos-marketplace/theme-system',
    '@hos-marketplace/api-client',
    '@hos-marketplace/utils',
  ],
  images: {
    unoptimized: false,
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.shopify.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.amazonaws.com', pathname: '/**' },
      { protocol: 'https', hostname: 'join.houseofspells.com', pathname: '/**' },
      { protocol: 'https', hostname: 'hos-world-web.vercel.app', pathname: '/**' },
      ...(process.env.NODE_ENV !== 'production'
        ? [
            { protocol: 'http', hostname: 'localhost', pathname: '/**' },
            { protocol: 'http', hostname: '127.0.0.1', pathname: '/**' },
          ]
        : []),
    ],
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error', 'warn'] }
        : false,
  },
  productionBrowserSourceMaps: false,
  async redirects() {
    return [
      {
        source: '/auth/register',
        destination: '/register',
        permanent: true,
      },
      {
        // Ship-home and older links used this path; addresses live on profile.
        source: '/account/addresses',
        destination: '/profile?tab=addresses&action=add',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // CSP is now set per-request in middleware.ts with a unique nonce
          // (replaces the static 'unsafe-inline' that was here before).
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);


