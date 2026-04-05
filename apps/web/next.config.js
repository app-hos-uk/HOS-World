/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Re-enabled after fixing useEffect dependencies
  transpilePackages: [
    '@hos-marketplace/shared-types',
    '@hos-marketplace/theme-system',
    '@hos-marketplace/api-client',
    '@hos-marketplace/utils',
  ],
  images: {
    unoptimized: false,
    remotePatterns: [
      { protocol: 'https', hostname: '**.placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: '**.amazonaws.com', pathname: '/**' },
      { protocol: 'https', hostname: '**.railway.app', pathname: '/**' },
      { protocol: 'https', hostname: '**.railway.internal', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.shopify.com', pathname: '/**' },
      { protocol: 'https', hostname: '1drv.ms', pathname: '/**' },
      { protocol: 'https', hostname: 'onedrive.live.com', pathname: '/**' },
      { protocol: 'https', hostname: '**.1drv.com', pathname: '/**' },
      { protocol: 'http', hostname: 'localhost', pathname: '/**' },
      { protocol: 'https', hostname: 'localhost', pathname: '/**' },
      { protocol: 'http', hostname: '127.0.0.1', pathname: '/**' },
    ],
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  productionBrowserSourceMaps: false,
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
        ],
      },
    ];
  },
};

module.exports = nextConfig;


