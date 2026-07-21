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
      { protocol: 'https', hostname: 'hos-marketplaceweb-production.up.railway.app', pathname: '/**' },
      { protocol: 'https', hostname: 'hos-world-web.vercel.app', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
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
  productionBrowserSourceMaps: false,
  async redirects() {
    return [
      {
        source: '/auth/register',
        destination: '/register',
        permanent: true,
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
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https://res.cloudinary.com https://*.cloudinary.com https://images.unsplash.com https://images.pexels.com https://lh3.googleusercontent.com https://hos-world-web.vercel.app https://*.up.railway.app https://cdn.shopify.com https://www.facebook.com https://picsum.photos",
              "font-src 'self' https://fonts.gstatic.com data:",
              "connect-src 'self' https://*.houseofspells.com https://*.up.railway.app https://api.stripe.com https://www.google-analytics.com https://www.googletagmanager.com https://www.facebook.com https://graph.facebook.com wss://*.houseofspells.com",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);


