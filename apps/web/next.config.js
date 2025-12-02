/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
};

module.exports = nextConfig;


